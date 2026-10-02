import type { EncryptedPayload } from '@/core/crypto/format';

/** Technical app setting (theme, developer mode …). Never personal data. */
export interface Setting {
  key: string;
  value: unknown;
}

/** Technical key-value entry (vault parameters, failed attempts). */
export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * Stored row of an encrypted table. Only technical fields stay readable; everything
 * content is inside the AES-GCM payload.
 */
export interface EncryptedRow {
  id: string;
  updatedAt: string;
  payload: EncryptedPayload;
}

/**
 * Stored file (photo, font, screenshot, cover): header (name, type, size) and bytes are
 * encrypted separately, so lists can show the header without decrypting large images.
 */
export interface FileRow {
  id: string;
  updatedAt: string;
  meta: EncryptedPayload;
  payload: EncryptedPayload;
}

/** Encrypted secret, e.g. the optional API key or a YouTube/Instagram token. */
export interface SecretRow {
  key: string;
  updatedAt: string;
  payload: EncryptedPayload;
}

/** Encrypted snapshot of all data (backups, step 12). */
export interface SnapshotRow {
  id: string;
  createdAt: string;
  payload: EncryptedPayload;
}

/** Encrypted error log entry (error messages can contain content). */
export interface ErrorLogRow {
  id: string;
  at: string;
  payload: EncryptedPayload;
}
