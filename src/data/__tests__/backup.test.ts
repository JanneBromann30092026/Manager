import { beforeEach, describe, expect, it } from 'vitest';
import { filesRepo, ideasRepo, postsRepo, secretsRepo, videosRepo } from '@/data/repositories';
import { db } from '@/data/db';
import { useDataStore } from '@/data/store';
import { BackupError, createBackup, readBackup, restoreBackup } from '@/services/backup';
import { vault } from '@/services/vault';
import { resetDb } from './testDb';

const PASSWORD = 'Manager-Test-2026!';

async function freshVault(password = PASSWORD) {
  vault.lock();
  await resetDb();
  await vault.init(true);
  await vault.setup(password);
  vault.finishOpening();
}

async function seed() {
  await videosRepo.create({ date: '2026-10-05', topic: 'Erfundenes Demo-Video' });
  await ideasRepo.create({ title: 'Erfundene Demo-Idee' });
  await postsRepo.create({
    date: '2026-10-01',
    platform: 'instagram',
    format: 'reel',
    topic: 'Demo-Reel',
    measuredAt: '2026-10-02T10:00:00.000Z',
    views: 1200,
    newFollowers: 6,
  });
  await filesRepo.put(
    'photo',
    new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
    'demo.png',
  );
  await secretsRepo.set('anthropicApiKey', 'sk-ant-demo-secret-value');
}

describe('backup', () => {
  beforeEach(() => freshVault());

  it('round-trips all data and files into a fresh vault with another password', async () => {
    await seed();
    const created = await createBackup(PASSWORD, { planBudget: 300 });
    expect(created.counts).toMatchObject({ videos: 1, ideas: 1, posts: 1, files: 1 });
    const text = await created.blob.text();
    // Encrypted: no plaintext and no secrets in the file.
    expect(text).not.toContain('Demo-Reel');
    expect(text).not.toContain('sk-ant');

    await freshVault('Ganz-anderes-Passwort-1');
    expect(videosRepo.list()).toEqual([]);
    const preview = await readBackup(created.blob, PASSWORD);
    expect(preview.counts).toMatchObject({ videos: 1, ideas: 1, posts: 1, files: 1 });
    expect(preview.settings).toEqual({ planBudget: 300 });
    expect(preview.skipped).toBe(0);

    await restoreBackup(preview);
    expect(videosRepo.list().map((video) => video.topic)).toEqual(['Erfundenes Demo-Video']);
    expect(postsRepo.list()[0]).toMatchObject({ views: 1200, newFollowers: 6 });
    const [file] = await filesRepo.list();
    expect(file?.name).toBe('demo.png');
    const opened = await filesRepo.open(file!.id);
    expect(Array.from(new Uint8Array(await opened.arrayBuffer()))).toEqual([1, 2, 3, 4]);
    // Secrets never travel.
    expect(await secretsRepo.has('anthropicApiKey')).toBe(false);
  });

  it('replaces existing data instead of merging', async () => {
    await seed();
    const created = await createBackup(PASSWORD, {});
    await ideasRepo.create({ title: 'Kommt nach dem Backup' });
    expect(ideasRepo.list()).toHaveLength(2);
    await restoreBackup(await readBackup(created.blob, PASSWORD));
    expect(ideasRepo.list().map((idea) => idea.title)).toEqual(['Erfundene Demo-Idee']);
    expect(await db.ideas.count()).toBe(1);
    expect(useDataStore.getState().ready).toBe(true);
  });

  it('refuses a wrong password, foreign files and newer versions', async () => {
    await seed();
    await expect(createBackup('falsch', {})).rejects.toMatchObject({ reason: 'wrongPassword' });
    const created = await createBackup(PASSWORD, {});
    await expect(readBackup(created.blob, 'falsch')).rejects.toBeInstanceOf(BackupError);
    await expect(readBackup(created.blob, 'falsch')).rejects.toMatchObject({
      reason: 'wrongPassword',
    });
    await expect(readBackup(new Blob(['{"hello":1}']), PASSWORD)).rejects.toMatchObject({
      reason: 'format',
    });
    await expect(readBackup(new Blob(['kein json']), PASSWORD)).rejects.toMatchObject({
      reason: 'format',
    });
    const newer = JSON.stringify({ ...JSON.parse(await created.blob.text()), version: 2 });
    await expect(readBackup(new Blob([newer]), PASSWORD)).rejects.toMatchObject({
      reason: 'newer',
    });
  });
});
