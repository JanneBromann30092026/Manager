/**
 * Key figures from posts. Main metric: new followers per 1,000 views (one decimal).
 * Unknown values stay unknown – a post only counts for a metric if both values are known.
 */
import type { Format, HookType, Platform } from '@/data/domain';
import { addDays, inRange } from './dates';

/** The fields of a post the metrics need (keeps this module free of the data layer). */
export interface PostNumbers {
  id: string;
  date: string;
  platform: Platform;
  format: Format;
  topic?: string;
  hookType?: HookType;
  measuredAt: string;
  views?: number;
  nonFollowerPct?: number;
  avgWatchSeconds?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  newFollowers?: number;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** New followers per 1,000 views; undefined if unknown or no views. */
export function followersPer1000(newFollowers?: number, views?: number): number | undefined {
  if (newFollowers === undefined || views === undefined || views <= 0) return undefined;
  return round1((newFollowers / views) * 1000);
}

export interface Totals {
  posts: number;
  views: number;
  newFollowers: number;
  /** Posts where both views and new followers are known (the base of the rate). */
  counted: number;
  rate: number | undefined;
}

/** Sums over posts; the rate only uses posts with both values known. */
export function totals(posts: readonly PostNumbers[]): Totals {
  let views = 0;
  let newFollowers = 0;
  let counted = 0;
  let allViews = 0;
  for (const post of posts) {
    allViews += post.views ?? 0;
    if (post.views !== undefined && post.newFollowers !== undefined) {
      views += post.views;
      newFollowers += post.newFollowers;
      counted += 1;
    }
  }
  return {
    posts: posts.length,
    views: allViews,
    newFollowers,
    counted,
    rate: counted > 0 ? followersPer1000(newFollowers, views) : undefined,
  };
}

export function postsBetween<T extends PostNumbers>(
  posts: readonly T[],
  start: string,
  end: string,
): T[] {
  return posts.filter((post) => inRange(post.date, start, end));
}

/** Last n days up to and including `today`. */
export function postsInLastDays<T extends PostNumbers>(
  posts: readonly T[],
  today: string,
  days: number,
): T[] {
  return postsBetween(posts, addDays(today, -(days - 1)), today);
}

/** Numbers read less than 24 hours after publishing are too early to judge. */
export function isTooEarly(post: Pick<PostNumbers, 'date' | 'measuredAt'>): boolean {
  const published = Date.parse(`${post.date}T00:00:00`);
  const measured = Date.parse(post.measuredAt);
  if (Number.isNaN(published) || Number.isNaN(measured)) return false;
  return measured - published < 24 * 60 * 60 * 1000;
}

function average(values: readonly (number | undefined)[]): number | undefined {
  const known = values.filter((value): value is number => value !== undefined);
  if (known.length === 0) return undefined;
  return round1(known.reduce((sum, value) => sum + value, 0) / known.length);
}

export interface GroupStats {
  key: string;
  posts: number;
  avgViews: number | undefined;
  avgNonFollowerPct: number | undefined;
  /** Rate over the summed views/followers of the group. */
  rate: number | undefined;
}

/** Averages per group (hook type, format, series, topic …); best rate first. */
export function groupStats<T extends PostNumbers>(
  posts: readonly T[],
  keyOf: (post: T) => string | undefined,
): GroupStats[] {
  const groups = new Map<string, T[]>();
  for (const post of posts) {
    const key = keyOf(post);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      posts: items.length,
      avgViews: (() => {
        const value = average(items.map((post) => post.views));
        return value === undefined ? undefined : Math.round(value);
      })(),
      avgNonFollowerPct: average(items.map((post) => post.nonFollowerPct)),
      rate: totals(items).rate,
    }))
    .sort(
      (a, b) =>
        (b.rate ?? -1) - (a.rate ?? -1) ||
        (b.avgViews ?? -1) - (a.avgViews ?? -1) ||
        a.key.localeCompare(b.key),
    );
}

/** Best and worst post by rate (posts without a rate are ignored). */
export function bestAndWorst<T extends PostNumbers>(posts: readonly T[]): { best?: T; worst?: T } {
  const rated = posts
    .map((post) => ({ post, rate: followersPer1000(post.newFollowers, post.views) }))
    .filter((item): item is { post: T; rate: number } => item.rate !== undefined)
    .sort((a, b) => b.rate - a.rate || (b.post.views ?? 0) - (a.post.views ?? 0));
  if (rated.length === 0) return {};
  return {
    best: rated[0]!.post,
    worst: rated.length > 1 ? rated[rated.length - 1]!.post : undefined,
  };
}
