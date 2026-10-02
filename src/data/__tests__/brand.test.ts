import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { brandRepo, defaultBrand, secretsRepo } from '@/data/repositories';
import { decryptRow } from '@/data/repositories/rows';
import { useDataStore } from '@/data/store';
import { CHANNEL_DEFAULTS, GROWTH_DEFAULTS, RULES_DEFAULTS } from '@/data/templates';
import { vault } from '@/services/vault';
import { resetDb } from './testDb';

beforeEach(async () => {
  vault.lock();
  await resetDb();
  await vault.init(true);
  await vault.setup('Manager-Test-2026!');
  vault.finishOpening();
});

describe('brandRepo', () => {
  it('shows the template defaults until something is saved', () => {
    const brand = brandRepo.get();
    expect(brandRepo.isStored()).toBe(false);
    expect(brand.channel.name).toBe(CHANNEL_DEFAULTS.name);
    expect(brand.channel.frame).toEqual(CHANNEL_DEFAULTS.frame);
    expect(brand.rules).toEqual(RULES_DEFAULTS);
    expect(brand.growth).toEqual(GROWTH_DEFAULTS);
    expect(brand.colors.main).toBe('#0369A1');
    expect(brand.checklist).toEqual({});
    expect(defaultBrand()).toEqual(brand);
  });

  it('stores one encrypted record and merges patches', async () => {
    const first = await brandRepo.update({ checklist: { bio: true } });
    const second = await brandRepo.update({
      colors: { ...first.colors, main: '#123abc' },
      rules: ['Kurz und knapp.', '  ', 'Keine Anlageberatung.'],
    });
    expect(second.id).toBe(first.id);
    expect(second.checklist).toEqual({ bio: true });
    expect(second.colors.main).toBe('#123ABC');
    expect(second.rules).toEqual(['Kurz und knapp.', 'Keine Anlageberatung.']);
    expect(await db.brand.count()).toBe(1);
    const row = await db.brand.get(first.id);
    expect(Object.keys(row ?? {}).sort()).toEqual(['id', 'payload', 'updatedAt']);
    expect(await decryptRow('brand', row!)).toEqual(second);
  });

  it('rejects invalid colors and resets to the templates', async () => {
    await expect(
      brandRepo.update({ colors: { ...brandRepo.get().colors, main: 'blau' } }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await brandRepo.update({ channel: { ...brandRepo.get().channel, name: 'Test' } });
    expect(brandRepo.get().channel.name).toBe('Test');
    await brandRepo.reset();
    expect(brandRepo.isStored()).toBe(false);
    expect(Object.keys(useDataStore.getState().brand)).toEqual([]);
    expect(brandRepo.get().channel.name).toBe(CHANNEL_DEFAULTS.name);
  });
});

describe('secretsRepo', () => {
  it('stores the API key encrypted and never in the store', async () => {
    expect(await secretsRepo.get('anthropicApiKey')).toBeNull();
    await secretsRepo.set('anthropicApiKey', '  sk-ant-test-123  ');
    expect(await secretsRepo.has('anthropicApiKey')).toBe(true);
    expect(await secretsRepo.get('anthropicApiKey')).toBe('sk-ant-test-123');
    const row = await db.secrets.get('anthropicApiKey');
    expect(JSON.stringify(row)).not.toContain('sk-ant');
    expect(JSON.stringify(useDataStore.getState())).not.toContain('sk-ant');
    await secretsRepo.remove('anthropicApiKey');
    expect(await secretsRepo.has('anthropicApiKey')).toBe(false);
  });

  it('survives a password change', async () => {
    await secretsRepo.set('anthropicApiKey', 'sk-ant-test-456');
    await vault.changePassword('Manager-Test-2026!', 'Neues-Passwort-2026');
    expect(await secretsRepo.get('anthropicApiKey')).toBe('sk-ant-test-456');
  });
});
