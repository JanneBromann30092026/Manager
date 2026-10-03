import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/data/__tests__/testDb';
import { brandRepo, ideasRepo, videosRepo } from '@/data/repositories';
import { vault } from '@/services/vault';
import { createVideo, setBlock, setVideoCta, setVideoStatus } from './videoActions';

beforeEach(async () => {
  vault.lock();
  await resetDb();
  await vault.init(true);
  await vault.setup('Manager-Test-2026!');
  vault.finishOpening();
});

describe('video actions', () => {
  it('rotates the CTA with every new package and remembers the state', async () => {
    const a = await createVideo({ topic: 'A', date: '2026-10-05', kind: 'reel' });
    const b = await createVideo({ topic: 'B', date: '2026-10-12', kind: 'reel' });
    const c = await createVideo({ topic: 'C', date: '2026-10-19', kind: 'podcast' });
    const d = await createVideo({ topic: 'D', date: '2026-10-26', kind: 'reel' });
    expect([a.cta, b.cta, c.cta, d.cta]).toEqual(['share', 'comment', 'follow', 'share']);
    expect(brandRepo.get().lastCta).toBe('share');
    await setVideoCta(d, 'follow');
    expect(videosRepo.get(d.id)?.cta).toBe('follow');
    const e = await createVideo({ topic: 'E', date: '2026-11-02', kind: 'reel' });
    expect(e.cta).toBe('share');
  });

  it('links an idea and moves it along with the video', async () => {
    const idea = await ideasRepo.create({
      title: 'Bausparvertrag?',
      source: 'community',
      series: 'Mythen-Check',
    });
    const video = await createVideo({
      topic: idea.title,
      date: '2026-10-05',
      kind: 'reel',
      ideaId: idea.id,
    });
    expect(video).toMatchObject({ ideaId: idea.id, series: 'Mythen-Check', status: 'idea' });
    expect(video.statusHistory).toHaveLength(1);
    expect(ideasRepo.get(idea.id)).toMatchObject({ videoId: video.id, status: 'planned' });

    const filmed = await setVideoStatus(video, 'filmed');
    expect(filmed.statusHistory.map((entry) => entry.status)).toEqual(['idea', 'filmed']);
    expect(ideasRepo.get(idea.id)?.status).toBe('filmed');
    await setVideoStatus(filmed, 'published');
    expect(ideasRepo.get(idea.id)?.status).toBe('published');
  });

  it('marks AI blocks until they are rewritten', async () => {
    const video = await createVideo({ topic: 'A', date: '2026-10-05', kind: 'reel' });
    const withAi = await setBlock(video, 'caption', 'Entwurf', true);
    expect(withAi.aiBlocks).toEqual(['caption']);
    const edited = await setBlock(withAi, 'caption', 'Eigener Text');
    expect(edited.aiBlocks).toEqual([]);
    expect(edited.blocks.caption).toBe('Eigener Text');
  });
});
