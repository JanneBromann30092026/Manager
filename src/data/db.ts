import { Dexie, type EntityTable } from 'dexie';
import type {
  EncryptedRow,
  ErrorLogRow,
  FileRow,
  MetaEntry,
  SecretRow,
  Setting,
  SnapshotRow,
} from './types';

/** Own name: Kompass and Synapse run on the same origin (GitHub Pages) with their own DBs. */
export const DB_NAME = 'manager';

/** Tables with content data (decrypted into the in-memory store after unlocking). */
export const DATA_TABLES = ['videos', 'ideas', 'posts', 'reports', 'plans', 'brand'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export class ManagerDb extends Dexie {
  settings!: EntityTable<Setting, 'key'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  videos!: EntityTable<EncryptedRow, 'id'>;
  ideas!: EntityTable<EncryptedRow, 'id'>;
  posts!: EntityTable<EncryptedRow, 'id'>;
  reports!: EntityTable<EncryptedRow, 'id'>;
  plans!: EntityTable<EncryptedRow, 'id'>;
  brand!: EntityTable<EncryptedRow, 'id'>;
  files!: EntityTable<FileRow, 'id'>;
  secrets!: EntityTable<SecretRow, 'key'>;
  snapshots!: EntityTable<SnapshotRow, 'id'>;
  errorLog!: EntityTable<ErrorLogRow, 'id'>;

  constructor(name = DB_NAME) {
    super(name);

    /*
     * Migrations: never change an existing version. Every schema change is a new
     * `this.version(n + 1).stores({...changed tables only}).upgrade(tx => ...)`.
     * Only indexed fields are listed; all other fields are stored anyway.
     * Content only ever lives in the encrypted `payload` of a row; readable are only
     * technical fields (ids, timestamps).
     */

    // Step 1: technical settings only (theme, motion, sidebar, developer mode). Unencrypted
    // on purpose: they contain no personal data and are needed before the app is unlocked.
    this.version(1).stores({
      settings: 'key',
    });

    // Step 2: vault parameters and the encrypted tables (new tables, nothing to migrate).
    this.version(2).stores({
      meta: 'key',
      videos: 'id, updatedAt',
      ideas: 'id, updatedAt',
      posts: 'id, updatedAt',
      reports: 'id, updatedAt',
      plans: 'id, updatedAt',
      files: 'id, updatedAt',
      secrets: 'key',
      snapshots: 'id, createdAt',
      errorLog: 'id, at',
    });

    // Step 3: brand record (channel profile, rules, brand kit) – new table, nothing to migrate.
    this.version(3).stores({
      brand: 'id, updatedAt',
    });
  }
}

export const db = new ManagerDb();

export type DbOpenErrorReason = 'unavailable' | 'quota' | 'version' | 'unknown';

export type DbOpenResult = { ok: true } | { ok: false; reason: DbOpenErrorReason };

function errorNames(error: unknown): string[] {
  const names: string[] = [];
  let current: unknown = error;
  // Dexie wraps the native error (e.g. OpenFailedError → inner QuotaExceededError).
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    names.push(current.name);
    current = (current as Error & { inner?: unknown }).inner;
  }
  return names;
}

export function classifyOpenError(error: unknown): DbOpenErrorReason {
  const names = errorNames(error);
  if (names.includes('QuotaExceededError')) return 'quota';
  if (names.includes('VersionError')) return 'version';
  if (
    names.includes('MissingAPIError') ||
    names.includes('InvalidStateError') ||
    names.includes('SecurityError') ||
    names.includes('UnknownError')
  ) {
    // No IndexedDB (private mode, disabled storage) or the browser refused access.
    return 'unavailable';
  }
  return 'unknown';
}

/** Opens the database once at startup. Never throws; the UI shows the reason on failure. */
export async function openDatabase(database: ManagerDb = db): Promise<DbOpenResult> {
  try {
    await database.open();
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, reason: classifyOpenError(error) };
  }
}
