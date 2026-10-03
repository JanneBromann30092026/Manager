import { describe, expect, it } from 'vitest';
import { postSchema, type Post } from '@/data/schemas';
import { analyzeFactors, timeOfDay } from './factors';

const NOW = new Date('2026-10-20T12:00:00Z');
let counter = 0;

function reel(date: string, views: number, extra: Partial<Post> = {}): Post {
  counter += 1;
  return postSchema.parse({
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    date,
    platform: 'instagram',
    format: 'reel',
    measuredAt: '2026-10-19T12:00:00.000Z',
    views,
    createdAt: '2026-10-19T12:00:00.000Z',
    updatedAt: '2026-10-19T12:00:00.000Z',
    ...extra,
  });
}

describe('factor analysis', () => {
  it('needs at least four comparable reels', () => {
    const result = analyzeFactors([reel('2026-10-01', 100), reel('2026-10-02', 200)], {
      now: NOW,
    });
    expect(result.enough).toBe(false);
    expect(result.factors).toEqual([]);
  });

  it('leaves out young reels and other platforms', () => {
    const result = analyzeFactors(
      [
        reel('2026-10-01', 100),
        reel('2026-10-19', 5, { measuredAt: '2026-10-19T20:00:00.000Z' }),
        reel('2026-10-02', 100, { platform: 'youtube', format: 'short' }),
      ],
      { now: NOW },
    );
    expect(result.reels).toBe(1);
    expect(result.tooYoung).toBe(1);
  });

  it('finds weekdays and hashtag groups above and below the median', () => {
    // Tuesdays (2026-10-06, -13) strong, Saturdays weak.
    const posts = [
      reel('2026-10-06', 1000, { hashtagCount: 2 }),
      reel('2026-10-13', 900, { hashtagCount: 1 }),
      reel('2026-10-08', 400, { hashtagCount: 0 }),
      reel('2026-10-09', 400, { hashtagCount: 0 }),
      reel('2026-10-10', 100, { hashtagCount: 8 }),
      reel('2026-10-03', 120, { hashtagCount: 6 }),
    ];
    const result = analyzeFactors(posts, { now: NOW });
    expect(result.enough).toBe(true);
    expect(result.medianViews).toBe(400);
    const weekday = result.factors.find((factor) => factor.factor === 'weekday')!;
    expect(weekday.groups.map((group) => group.key)).toEqual(['2', '4', '5', '6']);
    expect(weekday.groups[0]).toMatchObject({ posts: 2, medianViews: 950 });
    const tuesday = result.findings.find((f) => f.factor === 'weekday' && f.key === '2')!;
    expect(tuesday.ratio).toBeCloseTo(2.375);
    expect(tuesday.uncertain).toBe(true);
    const hashtags = result.factors.find((factor) => factor.factor === 'hashtags')!;
    expect(hashtags.groups.map((group) => group.key)).toEqual(['none', 'few', 'many']);
    expect(result.findings.some((f) => f.factor === 'hashtags' && f.key === 'many')).toBe(true);
  });

  it('prefers the value after 7 days from the history', () => {
    const publishedAt = '2026-10-01T16:00:00.000Z';
    const posts = [
      reel('2026-10-01', 5000, {
        publishedAt,
        history: [{ at: '2026-10-08T15:00:00.000Z', views: 700 }],
      }),
      reel('2026-10-02', 100),
      reel('2026-10-03', 100),
      reel('2026-10-04', 100),
    ];
    const result = analyzeFactors(posts, { now: NOW });
    expect(result.atSevenDays).toBe(1);
    expect(result.medianViews).toBe(100);
    // Only one rhythm group (daily): nothing to compare.
    expect(result.factors.some((factor) => factor.factor === 'gap')).toBe(false);
  });

  it('computes interactions per 1,000 views and series from the lookup', () => {
    const posts = [
      reel('2026-10-01', 1000, { likes: 40, saves: 10 }),
      reel('2026-10-02', 1000, { likes: 10 }),
      reel('2026-10-03', 500),
      reel('2026-10-04', 500),
    ];
    const result = analyzeFactors(posts, {
      now: NOW,
      seriesOf: (post) => (post.views === 1000 ? 'Gehalt' : 'Basics'),
    });
    const series = result.factors.find((factor) => factor.factor === 'series')!;
    expect(series.groups[0]).toMatchObject({ key: 'Gehalt', interactionsPer1000: 30 });
    expect(series.groups[1]!.interactionsPer1000).toBeUndefined();
  });

  it('compares YouTube Shorts by length with new followers per 1,000 views', () => {
    const short = (date: string, views: number, length: number, newFollowers: number) =>
      reel(date, views, {
        platform: 'youtube',
        format: 'short',
        newFollowers,
        retention: { lengthSeconds: length },
      });
    const posts = [
      short('2026-10-01', 2000, 25, 20),
      short('2026-10-02', 1800, 28, 9),
      short('2026-10-03', 400, 75, 2),
      short('2026-10-04', 500, 80, 1),
      reel('2026-10-05', 99_999),
      reel('2026-10-06', 1, { platform: 'youtube', format: 'video' }),
    ];
    const result = analyzeFactors(posts, { now: NOW, platform: 'youtube' });
    expect(result.reels).toBe(4);
    const length = result.factors.find((factor) => factor.factor === 'length')!;
    expect(length.groups.map((group) => group.key)).toEqual(['xs', 'mid']);
    expect(length.groups[0]!.followersPer1000).toBeCloseTo((29 / 3800) * 1000);
    expect(analyzeFactors(posts, { now: NOW }).reels).toBe(1);
  });

  it('maps the local hour to a time of day', () => {
    const local = (hour: number) => new Date(2026, 9, 1, hour, 30).toISOString();
    expect(timeOfDay(local(7))).toBe('morning');
    expect(timeOfDay(local(12))).toBe('midday');
    expect(timeOfDay(local(16))).toBe('afternoon');
    expect(timeOfDay(local(19))).toBe('evening');
    expect(timeOfDay(local(23))).toBe('night');
  });
});
