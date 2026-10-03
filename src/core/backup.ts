/**
 * Encrypted backup file (pure format, no Web Crypto calls). The file is JSON: an envelope with
 * the PBKDF2 parameters and the AES-GCM ciphertext of the (gzip-compressed) content. The content
 * holds all data tables, the files (brand photos, fonts) and a few technical settings – never
 * secrets (API key, Instagram token, push keys).
 */
import { z } from 'zod';
import {
  MAX_PBKDF2_ITERATIONS,
  MIN_PBKDF2_ITERATIONS,
  SALT_BYTES,
  IV_BYTES,
} from './crypto/format';

export const BACKUP_FORMAT = 'manager-backup';
export const BACKUP_VERSION = 1;
/** AAD of the backup ciphertext (binds it to this format). */
export const BACKUP_AAD = `${BACKUP_FORMAT}:v${BACKUP_VERSION}`;
/** Remind to export after this many days (and when there was never a backup). */
export const BACKUP_REMINDER_DAYS = 14;

/** Technical settings that travel with the backup (not device-specific ones). */
export const BACKUP_SETTING_KEYS = [
  'theme',
  'reduceMotion',
  'lockAfterMinutes',
  'aiEnabled',
  'aiModel',
  'googleClientId',
  'planBudget',
  'planDurations',
  'pushSchedule',
] as const;

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);

export const backupEnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.iso.datetime(),
  appVersion: z.string().max(40),
  kdf: z.object({
    alg: z.literal('PBKDF2-SHA-256'),
    iterations: z.int().min(MIN_PBKDF2_ITERATIONS).max(MAX_PBKDF2_ITERATIONS),
    salt: base64,
  }),
  iv: base64,
  compression: z.enum(['gzip', 'none']),
  data: base64,
});
export type BackupEnvelope = z.output<typeof backupEnvelopeSchema>;

export const backupFileSchema = z.object({
  id: z.uuid(),
  updatedAt: z.string(),
  meta: z.unknown(),
  data: base64,
});
export type BackupFile = z.output<typeof backupFileSchema>;

export const backupContentSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.iso.datetime(),
  tables: z.record(z.string(), z.array(z.unknown())),
  files: z.array(backupFileSchema).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
});
export type BackupContent = z.output<typeof backupContentSchema>;

export function isValidSalt(bytes: Uint8Array): boolean {
  return bytes.length === SALT_BYTES;
}

export function isValidIv(bytes: Uint8Array): boolean {
  return bytes.length === IV_BYTES;
}

/** Standard base64 for large byte arrays (chunked, no call-stack overflow). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** "manager-backup-2026-10-03.json" */
export function backupFileName(date: string): string {
  return `${BACKUP_FORMAT}-${date}.json`;
}

export interface BackupReminder {
  due: boolean;
  /** Whole days since the last backup (null = never). */
  days: number | null;
}

/** Reminds when there is data and no backup yet, or the last one is older than 14 days. */
export function backupReminder(
  lastBackupAt: string,
  now: Date,
  hasData: boolean,
  intervalDays = BACKUP_REMINDER_DAYS,
): BackupReminder {
  const last = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  if (Number.isNaN(last)) return { due: hasData, days: null };
  const days = Math.max(0, Math.floor((now.getTime() - last) / (24 * 60 * 60 * 1000)));
  return { due: hasData && days >= intervalDays, days };
}
