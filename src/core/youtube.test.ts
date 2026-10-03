import { describe, expect, it } from 'vitest';
import {
  analyticsByVideo,
  analyticsResponseSchema,
  chunk,
  parseIsoDuration,
  planYouTubeImport,
  videoToDraft,
  videosResponseSchema,
} from './youtube';

const videos = videosResponseSchema.parse({
  items: [
    {
      id: 'vid1',
      snippet: { title: 'Erfundenes Demo-Video', publishedAt: '2026-09-30T16:00:00Z' },
      contentDetails: { duration: 'PT12M30S' },
      statistics: { viewCount: '1234', likeCount: '56', commentCount: '7' },
    },
    {
      id: 'vid2',
      snippet: { title: 'Kurz erklärt #shorts', publishedAt: '2026-10-01T08:00:00Z' },
      contentDetails: { duration: 'PT2M50S' },
      statistics: { viewCount: '300' },
    },
  ],
}).items;

describe('youtube mapping', () => {
  it('parses ISO 8601 durations', () => {
    expect(parseIsoDuration('PT1M5S')).toBe(65);
    expect(parseIsoDuration('PT1H')).toBe(3600);
    expect(parseIsoDuration('P1DT2S')).toBe(86402);
    expect(parseIsoDuration('PT')).toBeUndefined();
    expect(parseIsoDuration('abc')).toBeUndefined();
    expect(parseIsoDuration(undefined)).toBeUndefined();
  });

  it('reads analytics columns by name', () => {
    const map = analyticsByVideo(
      analyticsResponseSchema.parse({
        columnHeaders: [
          { name: 'subscribersGained' },
          { name: 'video' },
          { name: 'averageViewDuration' },
        ],
        rows: [[3, 'vid1', 95.6]],
      }),
    );
    expect(map.get('vid1')).toEqual({ avgWatchSeconds: 96, subscribersGained: 3 });
    expect(analyticsByVideo(analyticsResponseSchema.parse({})).size).toBe(0);
  });

  it('maps videos to drafts; unknown values stay empty; shorts up to 3 minutes', () => {
    const first = videoToDraft(videos[0]!, { avgWatchSeconds: 96, subscribersGained: 3 });
    expect(first).toMatchObject({
      externalId: 'vid1',
      platform: 'youtube',
      format: 'video',
      topic: 'Erfundenes Demo-Video',
      views: 1234,
      likes: 56,
      comments: 7,
      avgWatchSeconds: 96,
      newFollowers: 3,
      retention: { lengthSeconds: 750 },
    });
    expect(first.date).toMatch(/^2026-09-30|2026-10-01$/);
    const second = videoToDraft(videos[1]!);
    expect(second.format).toBe('short');
    expect(second.likes).toBeUndefined();
    expect(second.newFollowers).toBeUndefined();
  });

  it('matches by YouTube id, then by day and title; the rest is new', () => {
    const drafts = videos.map((video) => videoToDraft(video));
    const existing = [
      {
        id: 'p1',
        date: drafts[0]!.date,
        platform: 'youtube' as const,
        topic: 'erfundenes demo-video',
      },
      {
        id: 'p2',
        date: '2026-01-01',
        platform: 'youtube' as const,
        topic: 'x',
        externalId: 'vid2',
      },
    ];
    const plans = planYouTubeImport(existing, drafts);
    expect(plans.map((plan) => (plan.kind === 'update' ? plan.target.id : 'new'))).toEqual([
      'p1',
      'p2',
    ]);
    expect(planYouTubeImport([], drafts).every((plan) => plan.kind === 'create')).toBe(true);
  });

  it('chunks ids by 50', () => {
    expect(chunk(Array.from({ length: 120 }, (_, i) => i)).map((part) => part.length)).toEqual([
      50, 50, 20,
    ]);
  });
});
