/**
 * Encrypted secrets (optional Claude API key, later YouTube/Instagram tokens). Never in the
 * in-memory store, never logged, never exported; decrypted only when needed.
 */
import { z } from 'zod';
import { recordAad } from '@/core/crypto/format';
import { requireSessionKey } from '@/services/crypto/session';
import { decryptJson, encryptJson } from '@/services/crypto/webCrypto';
import { nextTimestamp } from '@/core/time';
import { db } from '../db';

export const SECRET_KEYS = ['anthropicApiKey'] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

const valueSchema = z.string().min(1).max(10_000);

export const secretsRepo = {
  async has(key: SecretKey): Promise<boolean> {
    return (await db.secrets.get(key)) !== undefined;
  },

  async get(key: SecretKey): Promise<string | null> {
    const row = await db.secrets.get(key);
    if (!row) return null;
    const value = await decryptJson(requireSessionKey(), row.payload, recordAad('secrets', key));
    return valueSchema.parse(value);
  },

  async set(key: SecretKey, value: string): Promise<void> {
    const secret = valueSchema.parse(value.trim());
    const payload = await encryptJson(requireSessionKey(), secret, recordAad('secrets', key));
    const previous = await db.secrets.get(key);
    await db.secrets.put({ key, updatedAt: nextTimestamp(previous?.updatedAt), payload });
  },

  async remove(key: SecretKey): Promise<void> {
    await db.secrets.delete(key);
  },
};
