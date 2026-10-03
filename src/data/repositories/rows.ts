/**
 * Encryption of data rows: the decrypted record becomes an AES-GCM payload bound to its
 * table and id; only id and updatedAt stay readable.
 */
import type { z } from 'zod';
import { recordAad } from '@/core/crypto/format';
import { decryptJson, encryptJson } from '@/services/crypto/webCrypto';
import { requireSessionKey } from '@/services/crypto/session';
import { db, DATA_TABLES, type DataTable } from '../db';
import {
  accountStatSchema,
  brandSchema,
  ideaSchema,
  planSchema,
  postSchema,
  reportSchema,
  videoSchema,
} from '../schemas';
import { dataStore, type DataMaps, type DataRecords } from '../store';
import type { EncryptedRow } from '../types';

const SCHEMAS: { [T in DataTable]: z.ZodType<DataRecords[T]> } = {
  videos: videoSchema,
  ideas: ideaSchema,
  posts: postSchema,
  reports: reportSchema,
  plans: planSchema,
  brand: brandSchema,
  accountStats: accountStatSchema,
};

export function recordSchema<T extends DataTable>(table: T): z.ZodType<DataRecords[T]> {
  return SCHEMAS[table];
}

export async function encryptRow<T extends DataTable>(
  table: T,
  record: DataRecords[T],
  key: CryptoKey = requireSessionKey(),
): Promise<EncryptedRow> {
  const payload = await encryptJson(key, record, recordAad(table, record.id));
  return { id: record.id, updatedAt: record.updatedAt, payload };
}

/** Decrypts and validates a row. Throws DecryptionError / a zod error on damaged data. */
export async function decryptRow<T extends DataTable>(
  table: T,
  row: EncryptedRow,
  key: CryptoKey = requireSessionKey(),
): Promise<DataRecords[T]> {
  const value = await decryptJson(key, row.payload, recordAad(table, row.id));
  return SCHEMAS[table].parse(value);
}

export interface PendingWrite {
  table: DataTable;
  record: DataRecords[DataTable];
}

export interface PendingDelete {
  table: DataTable;
  ids: string[];
}

/**
 * Encrypts first (Web Crypto must not run inside an IndexedDB transaction), then writes
 * everything in one transaction and finally updates the in-memory store.
 */
export async function commit(writes: PendingWrite[], deletes: PendingDelete[] = []): Promise<void> {
  const key = requireSessionKey();
  const rows = await Promise.all(
    writes.map(async ({ table, record }) => ({ table, row: await encryptRow(table, record, key) })),
  );
  const tables = [...new Set([...writes.map((w) => w.table), ...deletes.map((d) => d.table)])];
  await db.transaction(
    'rw',
    tables.map((table) => db.table(table)),
    async () => {
      for (const { table, ids } of deletes) await db.table(table).bulkDelete(ids);
      for (const { table, row } of rows) await db.table(table).put(row);
    },
  );
  for (const { table, ids } of deletes) dataStore.remove(table, ids);
  for (const { table, record } of writes) dataStore.upsert(table, [record]);
}

/** Decrypts every data table into the store (after unlocking). */
export async function loadAllData(key: CryptoKey = requireSessionKey()): Promise<void> {
  let unreadable = 0;
  const entries = await Promise.all(
    DATA_TABLES.map(async (table) => {
      const rows = await db.table<EncryptedRow, string>(table).toArray();
      const map: Record<string, DataRecords[DataTable]> = {};
      await Promise.all(
        rows.map(async (row) => {
          try {
            map[row.id] = await decryptRow(table, row, key);
          } catch (error: unknown) {
            unreadable += 1;
            console.warn(`Unreadable row in ${table}`, error instanceof Error ? error.name : '');
          }
        }),
      );
      return [table, map] as const;
    }),
  );
  dataStore.replaceAll(Object.fromEntries(entries) as unknown as DataMaps, unreadable);
}
