import { describe, expect, it } from 'vitest';
import {
  bestAndWorst,
  followersPer1000,
  groupStats,
  isTooEarly,
  postsInLastDays,
  totals,
  type PostNumbers,
} from './metrics';

const post = (fields: Partial<PostNumbers> & { id: string }): PostNumbers => ({
  date: '2026-09-28',
  platform: 'instagram',
  format: 'reel',
  measuredAt: '2026-10-02T10:00:00.000Z',
  ...fields,
});

describe('metrics', () => {
  it('computes new followers per 1,000 views with one decimal', () => {
    expect(followersPer1000(45, 9190)).toBe(4.9);
    expect(followersPer1000(0, 500)).toBe(0);
    expect(followersPer1000(undefined, 500)).toBeUndefined();
    expect(followersPer1000(3, 0)).toBeUndefined();
  });

  it('only counts posts with both values for the rate', () => {
    const result = totals([
      post({ id: 'a', views: 1000, newFollowers: 10 }),
      post({ id: 'b', views: 1000 }),
      post({ id: 'c', newFollowers: 5 }),
    ]);
    expect(result).toEqual({ posts: 3, views: 2000, newFollowers: 10, counted: 1, rate: 10 });
    expect(totals([]).rate).toBeUndefined();
  });

  it('filters the last days including today', () => {
    const posts = [
      post({ id: 'old', date: '2026-09-03' }),
      post({ id: 'in', date: '2026-09-04' }),
      post({ id: 'today', date: '2026-10-03' }),
      post({ id: 'future', date: '2026-10-04' }),
    ];
    expect(postsInLastDays(posts, '2026-10-03', 30).map((p) => p.id)).toEqual(['in', 'today']);
  });

  it('marks numbers under 24 hours as too early', () => {
    expect(
      isTooEarly({ date: '2026-10-02', measuredAt: new Date(2026, 9, 2, 20).toISOString() }),
    ).toBe(true);
    expect(
      isTooEarly({ date: '2026-10-02', measuredAt: new Date(2026, 9, 4, 8).toISOString() }),
    ).toBe(false);
  });

  it('groups by key with the best rate first', () => {
    const posts = [
      post({ id: 'a', hookType: 'question', views: 1000, newFollowers: 10, nonFollowerPct: 60 }),
      post({ id: 'b', hookType: 'question', views: 3000, newFollowers: 10, nonFollowerPct: 40 }),
      post({ id: 'c', hookType: 'number', views: 1000, newFollowers: 2 }),
      post({ id: 'd' }),
    ];
    const groups = groupStats(posts, (p) => p.hookType);
    expect(groups.map((g) => g.key)).toEqual(['question', 'number']);
    expect(groups[0]).toEqual({
      key: 'question',
      posts: 2,
      avgViews: 2000,
      avgNonFollowerPct: 50,
      rate: 5,
    });
  });

  it('finds best and worst post', () => {
    const posts = [
      post({ id: 'a', views: 1000, newFollowers: 2 }),
      post({ id: 'b', views: 1000, newFollowers: 9 }),
      post({ id: 'c' }),
    ];
    const { best, worst } = bestAndWorst(posts);
    expect(best?.id).toBe('b');
    expect(worst?.id).toBe('a');
    expect(bestAndWorst([posts[0]!]).worst).toBeUndefined();
  });
});
