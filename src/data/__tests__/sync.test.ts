import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { videosRepo } from '@/data/repositories';
import { encryptRow } from '@/data/repositories/rows';
import { videoSchema } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { vault } from '@/services/vault';
import { resetDb } from './testDb';

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i += 1) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
}

beforeEach(async () => {
  vault.lock();
  await resetDb();
  await vault.init(true);
  await vault.setup('Manager-Test-2026!');
  vault.finishOpening();
});

describe('sync with other tabs', () => {
  it('picks up rows written directly to the database (as another tab would)', async () => {
    const first = await videosRepo.create({ date: '2026-10-05', topic: 'Geldfehler' });
    const now = new Date(Date.now() + 1000).toISOString();
    const other = videoSchema.parse({
      id: crypto.randomUUID(),
      date: '2026-10-08',
      topic: 'Inflation',
      createdAt: now,
      updatedAt: now,
    });
    await db.videos.put(await encryptRow('videos', other));
    await waitFor(() => useDataStore.getState().videos[other.id]?.topic === 'Inflation');

    const renamed = { ...first, topic: '3 Geldfehler', updatedAt: now };
    await db.videos.put(await encryptRow('videos', renamed));
    await waitFor(() => useDataStore.getState().videos[first.id]?.topic === '3 Geldfehler');

    await db.videos.delete(other.id);
    await waitFor(() => !useDataStore.getState().videos[other.id]);
  });

  it('keeps local writes made right after a change', async () => {
    const created = await Promise.all(
      ['A', 'B', 'C', 'D'].map((topic) => videosRepo.create({ date: '2026-10-05', topic })),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(Object.keys(useDataStore.getState().videos).sort()).toEqual(
      created.map((v) => v.id).sort(),
    );
  });
});
