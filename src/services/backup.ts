/**
 * Encrypted backup: export (all data tables, files and technical settings, encrypted with the
 * app password and a fresh salt) and import (replaces all data). Secrets are never exported.
 * Format: src/core/backup.ts.
 */
import {
  BACKUP_AAD,
  BACKUP_FORMAT,
  BACKUP_SETTING_KEYS,
  BACKUP_VERSION,
  backupContentSchema,
  backupEnvelopeSchema,
  base64ToBytes,
  bytesToBase64,
  isValidIv,
  isValidSalt,
  type BackupContent,
  type BackupEnvelope,
} from '@/core/backup';
import {
  CRYPTO_FORMAT_VERSION,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
  type Bytes,
} from '@/core/crypto/format';
import { localDateOf } from '@/core/dates';
import { db, DATA_TABLES, type DataTable } from '@/data/db';
import { fileAad } from '@/data/repositories/filesRepo';
import { encryptRow, loadAllData, recordSchema } from '@/data/repositories/rows';
import { fileMetaSchema, type FileMeta } from '@/data/schemas';
import { useDataStore, type DataRecords } from '@/data/store';
import type { EncryptedRow, FileRow } from '@/data/types';
import { requireSessionKey } from './crypto/session';
import {
  decryptBytes,
  decryptJson,
  DecryptionError,
  deriveVaultKey,
  encryptBytes,
  encryptJson,
  randomBytes,
} from './crypto/webCrypto';
import { vault } from './vault';

export type BackupErrorReason = 'wrongPassword' | 'format' | 'newer' | 'damaged';

export class BackupError extends Error {
  constructor(readonly reason: BackupErrorReason) {
    super(`Backup failed: ${reason}`);
    this.name = 'BackupError';
  }
}

async function transform(data: Bytes, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([data]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

const canCompress = () =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export type BackupCounts = { [T in DataTable]: number } & { files: number };

function countsOf(tables: { [T in DataTable]: unknown[] }, files: number): BackupCounts {
  return {
    ...(Object.fromEntries(DATA_TABLES.map((table) => [table, tables[table].length])) as {
      [T in DataTable]: number;
    }),
    files,
  };
}

export interface CreatedBackup {
  blob: Blob;
  createdAt: string;
  counts: BackupCounts;
}

/**
 * Encrypts everything with the app password (checked first) and a fresh salt. `settings` are
 * the technical settings to include (BACKUP_SETTING_KEYS).
 */
export async function createBackup(
  password: string,
  settings: Record<string, unknown>,
): Promise<CreatedBackup> {
  if (!(await vault.verifyPassword(password))) throw new BackupError('wrongPassword');
  const sessionKey = requireSessionKey();
  const state = useDataStore.getState();
  const tables = Object.fromEntries(
    DATA_TABLES.map((table) => [table, Object.values(state[table])]),
  ) as { [T in DataTable]: DataRecords[T][] };

  const fileRows = await db.files.toArray();
  const files = await Promise.all(
    fileRows.map(async (row) => ({
      id: row.id,
      updatedAt: row.updatedAt,
      meta: await decryptJson(sessionKey, row.meta, fileAad.meta(row.id)),
      data: bytesToBase64(await decryptBytes(sessionKey, row.payload, fileAad.data(row.id))),
    })),
  );

  const createdAt = new Date().toISOString();
  const content: BackupContent = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    tables,
    files,
    settings: Object.fromEntries(BACKUP_SETTING_KEYS.map((key) => [key, settings[key]])),
  };
  const plain = new TextEncoder().encode(JSON.stringify(content));
  const compression = canCompress() ? 'gzip' : 'none';
  const packed =
    compression === 'gzip' ? await transform(plain, new CompressionStream('gzip')) : plain;

  const salt = randomBytes(SALT_BYTES);
  const key = await deriveVaultKey(password, salt, PBKDF2_ITERATIONS);
  const { iv, ct } = await encryptBytes(key, packed, BACKUP_AAD);
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    appVersion: __APP_VERSION__,
    kdf: { alg: 'PBKDF2-SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    iv: bytesToBase64(iv),
    compression,
    data: bytesToBase64(ct),
  };
  return {
    blob: new Blob([JSON.stringify(envelope)], { type: 'application/json' }),
    createdAt,
    counts: countsOf(tables, files.length),
  };
}

export interface BackupPreview {
  createdAt: string;
  tables: { [T in DataTable]: DataRecords[T][] };
  files: { id: string; updatedAt: string; meta: FileMeta; bytes: Bytes }[];
  /** Technical settings from the backup (unvalidated; the caller checks each one). */
  settings: Record<string, unknown>;
  counts: BackupCounts;
  /** Records or files that failed validation (left out). */
  skipped: number;
}

function parseEnvelope(text: string): BackupEnvelope {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('format');
  }
  const head = json as { format?: unknown; version?: unknown } | null;
  if (head?.format !== BACKUP_FORMAT) throw new BackupError('format');
  if (typeof head.version === 'number' && head.version > BACKUP_VERSION)
    throw new BackupError('newer');
  const parsed = backupEnvelopeSchema.safeParse(json);
  if (!parsed.success) throw new BackupError('format');
  return parsed.data;
}

/** Decrypts and validates a backup file; nothing is written yet. */
export async function readBackup(file: Blob, password: string): Promise<BackupPreview> {
  const envelope = parseEnvelope(await file.text());
  const salt = base64ToBytes(envelope.kdf.salt);
  const iv = base64ToBytes(envelope.iv);
  if (!isValidSalt(salt) || !isValidIv(iv)) throw new BackupError('format');
  const key = await deriveVaultKey(password, salt, envelope.kdf.iterations);
  let packed: Bytes;
  try {
    packed = await decryptBytes(
      key,
      { v: CRYPTO_FORMAT_VERSION, iv, ct: base64ToBytes(envelope.data) },
      BACKUP_AAD,
    );
  } catch (error: unknown) {
    if (error instanceof DecryptionError) throw new BackupError('wrongPassword');
    throw new BackupError('format');
  }

  let content: BackupContent;
  try {
    const plain =
      envelope.compression === 'gzip'
        ? await transform(packed, new DecompressionStream('gzip'))
        : packed;
    content = backupContentSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    throw new BackupError('damaged');
  }

  let skipped = 0;
  const tables = Object.fromEntries(
    DATA_TABLES.map((table) => {
      const valid = (content.tables[table] ?? []).flatMap((value) => {
        const parsed = recordSchema(table).safeParse(value);
        if (parsed.success) return [parsed.data];
        skipped += 1;
        return [];
      });
      return [table, valid];
    }),
  ) as BackupPreview['tables'];

  const files = content.files.flatMap((entry) => {
    const meta = fileMetaSchema.safeParse(entry.meta);
    if (!meta.success) {
      skipped += 1;
      return [];
    }
    return [
      {
        id: entry.id,
        updatedAt: entry.updatedAt,
        meta: meta.data,
        bytes: base64ToBytes(entry.data),
      },
    ];
  });

  const settings = Object.fromEntries(
    BACKUP_SETTING_KEYS.flatMap((key) =>
      content.settings[key] === undefined ? [] : [[key, content.settings[key]]],
    ),
  );

  return {
    createdAt: content.createdAt,
    tables,
    files,
    settings,
    counts: countsOf(tables, files.length),
    skipped,
  };
}

/** Replaces all data of this app with the backup (encrypted with the current key, one transaction). */
export async function restoreBackup(preview: BackupPreview): Promise<void> {
  const key = requireSessionKey();
  // Encrypt first: Web Crypto must not run inside an IndexedDB transaction.
  const rows = await Promise.all(
    DATA_TABLES.map(async (table) => ({
      table,
      rows: await Promise.all(
        (preview.tables[table] as DataRecords[DataTable][]).map((record) =>
          encryptRow(table, record, key),
        ),
      ),
    })),
  );
  const fileRows: FileRow[] = await Promise.all(
    preview.files.map(async (file) => ({
      id: file.id,
      updatedAt: file.updatedAt,
      meta: await encryptJson(key, file.meta, fileAad.meta(file.id)),
      payload: await encryptBytes(key, file.bytes, fileAad.data(file.id)),
    })),
  );
  await db.transaction(
    'rw',
    [...DATA_TABLES.map((table) => db.table(table)), db.files],
    async () => {
      for (const { table, rows: tableRows } of rows) {
        const target = db.table<EncryptedRow, string>(table);
        await target.clear();
        await target.bulkPut(tableRows);
      }
      await db.files.clear();
      await db.files.bulkPut(fileRows);
    },
  );
  await loadAllData(key);
}

/** "2026-10-03" for the file name. */
export function backupDate(createdAt: string): string {
  return localDateOf(new Date(createdAt));
}
