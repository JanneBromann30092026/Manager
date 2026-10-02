/**
 * Encrypted files (brand photos, poses, fonts, screenshots, covers). Header and bytes are
 * encrypted separately with their own AAD; the bytes are only decrypted when a file is
 * opened. Files are not kept in the in-memory store.
 */
import { recordAad } from '@/core/crypto/format';
import { nextTimestamp } from '@/core/time';
import { requireSessionKey } from '@/services/crypto/session';
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from '@/services/crypto/webCrypto';
import { db } from '../db';
import { parseOrThrow, RecordNotFoundError } from '../errors';
import type { FileKind } from '../domain';
import { fileMetaSchema, LIMITS, type FileMeta } from '../schemas';

/** AAD of a file's header and of its bytes (bound to the file and to each other). */
export const fileAad = {
  meta: (id: string) => recordAad('files.meta', id),
  data: (id: string) => recordAad('files', id),
};

/** The file is larger than LIMITS.fileBytes. */
export class FileTooLargeError extends Error {
  override readonly name = 'FileTooLargeError';
}

export interface StoredFile extends FileMeta {
  id: string;
}

export const filesRepo = {
  async put(kind: FileKind, file: Blob, name: string): Promise<StoredFile> {
    if (file.size > LIMITS.fileBytes) throw new FileTooLargeError(name);
    const key = requireSessionKey();
    const id = crypto.randomUUID();
    const now = nextTimestamp(undefined);
    const meta = parseOrThrow(fileMetaSchema, {
      kind,
      name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: now,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const [metaPayload, payload] = await Promise.all([
      encryptJson(key, meta, fileAad.meta(id)),
      encryptBytes(key, bytes, fileAad.data(id)),
    ]);
    await db.files.put({ id, updatedAt: now, meta: metaPayload, payload });
    return { id, ...meta };
  },

  /** Headers of all files (without decrypting the bytes). */
  async list(kind?: FileKind): Promise<StoredFile[]> {
    const key = requireSessionKey();
    const rows = await db.files.toArray();
    const files = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        ...fileMetaSchema.parse(await decryptJson(key, row.meta, fileAad.meta(row.id))),
      })),
    );
    return kind ? files.filter((file) => file.kind === kind) : files;
  },

  /** Decrypts a file for display or sharing. */
  async open(id: string): Promise<Blob> {
    const row = await db.files.get(id);
    if (!row) throw new RecordNotFoundError('files', id);
    const key = requireSessionKey();
    const meta = fileMetaSchema.parse(await decryptJson(key, row.meta, fileAad.meta(id)));
    const bytes = await decryptBytes(key, row.payload, fileAad.data(id));
    return new Blob([bytes], { type: meta.mime });
  },

  async remove(id: string): Promise<void> {
    await db.files.delete(id);
  },
};
