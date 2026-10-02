/**
 * Writing decrypted records: validation, timestamps and the encrypted commit. One generic
 * repository per data table (videos, ideas, posts, reports, plans).
 */
import type { z } from 'zod';
import { nextTimestamp } from '@/core/time';
import type { DataTable } from '../db';
import { parseOrThrow, RecordNotFoundError } from '../errors';
import { dataStore, useDataStore, type DataRecords } from '../store';
import { commit, recordSchema } from './rows';

/** Validates a full record against the table schema (throws ValidationError). */
export function validateRecord<T extends DataTable>(table: T, record: unknown): DataRecords[T] {
  return parseOrThrow(recordSchema(table), record);
}

export function requireRecord<T extends DataTable>(table: T, id: string): DataRecords[T] {
  const record = dataStore.get(table, id);
  if (!record) throw new RecordNotFoundError(table, id);
  return record;
}

export function createRecordRepo<T extends DataTable, S extends z.ZodType>(
  table: T,
  inputSchema: S,
) {
  type Item = DataRecords[T];
  return {
    list(): Item[] {
      return Object.values(useDataStore.getState()[table]) as Item[];
    },

    get(id: string): Item | undefined {
      return dataStore.get(table, id);
    },

    async create(input: z.input<S>): Promise<Item> {
      const fields = parseOrThrow(inputSchema, input) as object;
      const now = nextTimestamp(undefined);
      const record = validateRecord(table, {
        ...fields,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      });
      await commit([{ table, record }]);
      return record;
    },

    async update(id: string, patch: Partial<z.input<S>>): Promise<Item> {
      const current = requireRecord(table, id);
      const record = validateRecord(table, {
        ...current,
        ...patch,
        id,
        createdAt: current.createdAt,
        updatedAt: nextTimestamp(current.updatedAt),
      });
      await commit([{ table, record }]);
      return record;
    },

    async remove(id: string): Promise<void> {
      requireRecord(table, id);
      await commit([], [{ table, ids: [id] }]);
    },
  };
}
