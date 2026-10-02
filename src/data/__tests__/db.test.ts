import { Dexie } from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { classifyOpenError, ManagerDb, db, DB_NAME, openDatabase } from '../db';
import { settingsRepo } from '../repositories';
import { resetDb } from './testDb';

describe('database schema', () => {
  it('opens version 3 under its own name with all tables', async () => {
    expect(await openDatabase()).toEqual({ ok: true });
    expect(db.name).toBe(DB_NAME);
    expect(DB_NAME).toBe('manager');
    expect(db.verno).toBe(3);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        'brand',
        'errorLog',
        'files',
        'ideas',
        'meta',
        'plans',
        'posts',
        'reports',
        'secrets',
        'settings',
        'snapshots',
        'videos',
      ].sort(),
    );
    expect(db.settings.schema.primKey.name).toBe('key');
  });

  it('indexes only technical fields of the encrypted tables', () => {
    const indexes = (name: string) => db.table(name).schema.indexes.map((index) => index.name);
    for (const table of ['videos', 'ideas', 'posts', 'reports', 'plans', 'brand', 'files']) {
      expect(indexes(table)).toEqual(['updatedAt']);
    }
  });

  it('upgrades a step-1 database (settings only) and keeps its settings', async () => {
    const name = 'manager-upgrade-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({ settings: 'key' });
    await v1.open();
    await v1.table('settings').put({ key: 'theme', value: 'dark' });
    v1.close();
    const upgraded = new ManagerDb(name);
    expect(await openDatabase(upgraded)).toEqual({ ok: true });
    expect(upgraded.verno).toBe(3);
    expect(await upgraded.settings.get('theme')).toEqual({ key: 'theme', value: 'dark' });
    expect(await upgraded.videos.count()).toBe(0);
    upgraded.close();
    await Dexie.delete(name);
  });

  it('upgrades a step-2 database and keeps its encrypted rows', async () => {
    const name = 'manager-upgrade-test-2';
    const v2 = new Dexie(name);
    v2.version(1).stores({ settings: 'key' });
    v2.version(2).stores({ meta: 'key', videos: 'id, updatedAt' });
    await v2.open();
    await v2.table('videos').put({ id: 'a', updatedAt: '2026-10-02T10:00:00.000Z', payload: 1 });
    v2.close();
    const upgraded = new ManagerDb(name);
    expect(await openDatabase(upgraded)).toEqual({ ok: true });
    expect(await upgraded.videos.count()).toBe(1);
    expect(await upgraded.brand.count()).toBe(0);
    upgraded.close();
    await Dexie.delete(name);
  });
});

describe('open errors', () => {
  it('opens a database with a newer on-disk version (Dexie 4 tolerates app rollbacks)', async () => {
    const newer = new Dexie('manager-version-test');
    newer.version(5).stores({ settings: 'key' });
    await newer.open();
    newer.close();
    const older = new ManagerDb('manager-version-test');
    expect(await openDatabase(older)).toEqual({ ok: true });
    older.close();
    await Dexie.delete('manager-version-test');
  });

  it('classifies wrapped native errors', () => {
    const named = (name: string, inner?: Error) =>
      Object.assign(new Error('open failed'), { name, inner });
    expect(classifyOpenError(named('OpenFailedError', named('QuotaExceededError')))).toBe('quota');
    expect(classifyOpenError(named('OpenFailedError', named('InvalidStateError')))).toBe(
      'unavailable',
    );
    expect(classifyOpenError(named('MissingAPIError'))).toBe('unavailable');
    expect(classifyOpenError(named('VersionError'))).toBe('version');
    expect(classifyOpenError(new Error('boom'))).toBe('unknown');
    expect(classifyOpenError('not an error')).toBe('unknown');
  });
});

describe('settingsRepo', () => {
  beforeEach(resetDb);

  it('returns the fallback until a value is set', async () => {
    expect(await settingsRepo.get('theme', 'system')).toBe('system');
    await settingsRepo.set('theme', 'dark');
    expect(await settingsRepo.get('theme', 'system')).toBe('dark');
    await settingsRepo.remove('theme');
    expect(await settingsRepo.get('theme', 'system')).toBe('system');
  });

  it('falls back when the stored value does not match the schema', async () => {
    await settingsRepo.set('theme', 42);
    const schema = z.enum(['system', 'light', 'dark']);
    expect(await settingsRepo.get('theme', 'system', schema)).toBe('system');
  });

  it('rejects empty keys', async () => {
    await expect(settingsRepo.set(' ', 1)).rejects.toMatchObject({
      field: 'value',
      code: 'required',
    });
  });
});
