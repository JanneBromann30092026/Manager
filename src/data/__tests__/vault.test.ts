import { beforeEach, describe, expect, it } from 'vitest';
import { filesRepo, ideasRepo, metaRepo, postsRepo, videosRepo } from '@/data/repositories';
import { db } from '@/data/db';
import { useDataStore } from '@/data/store';
import { hasSessionKey } from '@/services/crypto/session';
import { useVault, vault } from '@/services/vault';
import { resetDb } from './testDb';

const PASSWORD = 'Manager-Test-2026!';

async function freshVault() {
  vault.lock();
  await resetDb();
  await vault.init(true);
  await vault.setup(PASSWORD);
  vault.finishOpening();
}

/** Everything stored, as text (byte arrays decoded), to search for plaintext. */
async function rawDump(): Promise<string> {
  const parts: string[] = [];
  for (const table of db.tables) {
    for (const row of await table.toArray()) {
      parts.push(
        JSON.stringify(row, (_key, value: unknown) =>
          value instanceof Uint8Array ? new TextDecoder('latin1').decode(value) : value,
        ),
      );
    }
  }
  return parts.join('\n');
}

describe('vault', () => {
  beforeEach(freshVault);

  it('sets up, locks and unlocks with the right password only', async () => {
    expect(useVault.getState().status).toBe('unlocked');
    await videosRepo.create({ date: '2026-10-05', topic: 'So teile ich mein Geld auf' });

    vault.lock();
    expect(useVault.getState().status).toBe('locked');
    expect(hasSessionKey()).toBe(false);
    expect(useDataStore.getState().videos).toEqual({});
    expect(() => videosRepo.list()).not.toThrow();
    expect(videosRepo.list()).toEqual([]);

    expect(await vault.unlock('falsch')).toMatchObject({ ok: false, reason: 'wrongPassword' });
    expect(useVault.getState().failures?.count).toBe(1);
    expect(await vault.unlock(PASSWORD)).toEqual({ ok: true });
    expect(useVault.getState().status).toBe('opening');
    expect(useVault.getState().failures).toBeNull();
    expect(videosRepo.list().map((v) => v.topic)).toEqual(['So teile ich mein Geld auf']);
  });

  it('makes you wait after the third wrong password', async () => {
    vault.lock();
    await vault.unlock('falsch 1');
    await vault.unlock('falsch 2');
    expect(await vault.unlock('falsch 3')).toEqual({
      ok: false,
      reason: 'wrongPassword',
      waitMs: 5_000,
    });
    expect(await vault.unlock(PASSWORD)).toMatchObject({ ok: false, reason: 'wait' });
    expect((await metaRepo.getUnlockFailures())?.count).toBe(3);
  });

  it('stores no plaintext anywhere', async () => {
    const video = await videosRepo.create({
      date: '2026-10-05',
      topic: 'Geldfehler in deinen Zwanzigern',
      series: 'Mythencheck',
      blocks: { script: 'Hook Widerspruch Folgengrund' },
    });
    await ideasRepo.create({ title: 'Bausparvertrag Community', source: 'community' });
    await postsRepo.create({
      date: '2026-10-02',
      platform: 'youtube',
      format: 'video',
      topic: 'Podcastfolge Steuern',
      measuredAt: new Date().toISOString(),
      views: 8,
    });
    await filesRepo.put(
      'photo',
      new Blob(['Freigestelltes Foto'], { type: 'image/png' }),
      'foto.png',
    );
    const dump = await rawDump();
    for (const text of [
      'Geldfehler',
      'Mythencheck',
      'Folgengrund',
      'Bausparvertrag',
      'Podcastfolge',
      'Freigestelltes',
      'foto.png',
    ]) {
      expect(dump).not.toContain(text);
    }
    expect(dump).toContain(video.id);
  });

  it('refuses a second setup', async () => {
    await expect(vault.setup('noch ein Passwort')).rejects.toThrow('Vault already exists');
  });

  it('changes the password and re-encrypts every row', async () => {
    const video = await videosRepo.create({ date: '2026-10-05', topic: 'Inflation' });
    await ideasRepo.create({ title: 'ETF-Sparplan' });
    const photo = await filesRepo.put('photo', new Blob(['bild'], { type: 'image/png' }), 'a.png');
    const before = (await db.videos.get(video.id))?.payload.ct;

    expect(await vault.changePassword('falsch', 'Neues-Passwort-2026')).toBe(false);
    expect(await vault.changePassword(PASSWORD, 'Neues-Passwort-2026')).toBe(true);
    const after = (await db.videos.get(video.id))?.payload.ct;
    expect(Array.from(after ?? [])).not.toEqual(Array.from(before ?? []));
    // The session keeps working with the new key.
    await videosRepo.update(video.id, { status: 'filmed' });

    vault.lock();
    expect(await vault.unlock(PASSWORD)).toMatchObject({ ok: false });
    expect(await vault.unlock('Neues-Passwort-2026')).toEqual({ ok: true });
    expect(videosRepo.get(video.id)?.status).toBe('filmed');
    expect(Object.values(useDataStore.getState().ideas)).toHaveLength(1);
    expect(await (await filesRepo.open(photo.id)).text()).toBe('bild');
    expect((await metaRepo.getVault())?.passwordChangedAt).toBeDefined();
  });

  it('resets everything', async () => {
    await videosRepo.create({ date: '2026-10-05', topic: 'Inflation' });
    await vault.resetAll();
    expect(useVault.getState().status).toBe('setup');
    await db.open();
    expect(await db.videos.count()).toBe(0);
    expect(await metaRepo.getVault()).toBeNull();
  });
});
