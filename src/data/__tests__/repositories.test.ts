import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { ValidationError } from '@/data/errors';
import {
  filesRepo,
  FileTooLargeError,
  ideasRepo,
  plansRepo,
  postsRepo,
  reportsRepo,
  videosRepo,
} from '@/data/repositories';
import { decryptRow } from '@/data/repositories/rows';
import { LIMITS } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { vault } from '@/services/vault';
import { resetDb } from './testDb';

beforeEach(async () => {
  vault.lock();
  await resetDb();
  await vault.init(true);
  await vault.setup('Manager-Test-2026!');
  vault.finishOpening();
});

describe('videosRepo', () => {
  it('fills defaults and validates input', async () => {
    const video = await videosRepo.create({ date: '2026-10-05', topic: '  Inflation  ' });
    expect(video).toMatchObject({
      topic: 'Inflation',
      kind: 'reel',
      status: 'idea',
      blocks: {},
      coverFileIds: [],
      demo: false,
    });
    await expect(videosRepo.create({ date: '2026-10-05', topic: ' ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(videosRepo.create({ date: '5.10.2026', topic: 'X' })).rejects.toMatchObject({
      field: 'date',
    });
  });

  it('writes encrypted rows with only technical fields readable', async () => {
    const video = await videosRepo.create({
      date: '2026-10-05',
      topic: 'So teile ich mein Geld auf',
      blocks: { script: 'Hook 1 …' },
    });
    const row = await db.videos.get(video.id);
    expect(Object.keys(row ?? {}).sort()).toEqual(['id', 'payload', 'updatedAt']);
    expect(row?.payload.iv).toHaveLength(12);
    expect(await decryptRow('videos', row!)).toEqual(video);
  });

  it('updates with a newer timestamp and keeps id and creation time', async () => {
    const video = await videosRepo.create({ date: '2026-10-05', topic: 'Inflation' });
    const updated = await videosRepo.update(video.id, {
      status: 'script',
      blocks: { script: 'Neu' },
    });
    expect(updated.id).toBe(video.id);
    expect(updated.createdAt).toBe(video.createdAt);
    expect(updated.updatedAt > video.updatedAt).toBe(true);
    expect(updated.blocks.script).toBe('Neu');
    expect(useDataStore.getState().videos[video.id]?.status).toBe('script');
  });

  it('removes records', async () => {
    const video = await videosRepo.create({ date: '2026-10-05', topic: 'Inflation' });
    await videosRepo.remove(video.id);
    expect(videosRepo.list()).toEqual([]);
    expect(await db.videos.count()).toBe(0);
    await expect(videosRepo.remove(video.id)).rejects.toMatchObject({
      name: 'RecordNotFoundError',
    });
  });
});

describe('ideas, posts, reports and plans', () => {
  it('store community questions as ideas', async () => {
    const idea = await ideasRepo.create({
      title: 'Lohnt sich ein Bausparvertrag?',
      source: 'community',
    });
    expect(idea).toMatchObject({ source: 'community', status: 'idea', personal: false });
  });

  it('create several ideas in one go', async () => {
    const ideas = await ideasRepo.createMany([
      { title: 'Frage 1', source: 'community' },
      { title: 'Frage 2', source: 'community' },
    ]);
    expect(ideas).toHaveLength(2);
    expect(ideas[1]!.createdAt > ideas[0]!.createdAt).toBe(true);
    expect(await db.ideas.count()).toBe(2);
    expect(ideasRepo.list()).toHaveLength(2);
    await expect(ideasRepo.createMany([{ title: 'ok' }, { title: ' ' }])).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await db.ideas.count()).toBe(2);
    expect(await ideasRepo.createMany([])).toEqual([]);
  });

  it('keep unknown numbers empty instead of estimating them', async () => {
    const post = await postsRepo.create({
      date: '2026-10-02',
      platform: 'youtube',
      format: 'video',
      measuredAt: '2026-10-02T21:00:00.000Z',
      views: 8,
      likes: 2,
      comments: 1,
    });
    expect(post.views).toBe(8);
    expect(post.newFollowers).toBeUndefined();
    expect(post.source).toBe('manual');
    await expect(
      postsRepo.create({
        date: '2026-10-02',
        platform: 'instagram',
        format: 'reel',
        measuredAt: '2026-10-02T21:00:00.000Z',
        nonFollowerPct: 140,
      }),
    ).rejects.toMatchObject({ field: 'nonFollowerPct' });
  });

  it('allow at most three measures per report and a valid week', async () => {
    const report = await reportsRepo.create({ week: '2026-W40', actions: ['A', 'B', 'C'] });
    expect(report.actions).toHaveLength(3);
    await expect(
      reportsRepo.create({ week: '2026-W40', actions: ['1', '2', '3', '4'] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(reportsRepo.create({ week: '2026-40' })).rejects.toMatchObject({ field: 'week' });
  });

  it('default the weekly budget to four hours', async () => {
    const plan = await plansRepo.create({
      week: '2026-W41',
      items: [
        {
          id: crypto.randomUUID(),
          date: '2026-10-06',
          kind: 'reel',
          title: 'Reel drehen',
          minutes: 90,
        },
      ],
    });
    expect(plan.budgetMinutes).toBe(240);
    expect(plan.items[0]?.done).toBe(false);
  });
});

describe('filesRepo', () => {
  it('encrypts header and bytes and opens them again', async () => {
    const stored = await filesRepo.put(
      'pose',
      new Blob(['png-bytes'], { type: 'image/png' }),
      'nachdenklich.png',
    );
    expect(stored).toMatchObject({ kind: 'pose', mime: 'image/png', size: 9 });
    const row = await db.files.get(stored.id);
    expect(Object.keys(row ?? {}).sort()).toEqual(['id', 'meta', 'payload', 'updatedAt']);
    expect((await filesRepo.list('pose')).map((f) => f.name)).toEqual(['nachdenklich.png']);
    expect(await filesRepo.list('font')).toEqual([]);
    const blob = await filesRepo.open(stored.id);
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('png-bytes');
    await filesRepo.remove(stored.id);
    expect(await db.files.count()).toBe(0);
  });

  it('refuses files above the size limit', async () => {
    const big = new Blob([new Uint8Array(LIMITS.fileBytes + 1)]);
    await expect(filesRepo.put('screenshot', big, 'gross.png')).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
  });
});
