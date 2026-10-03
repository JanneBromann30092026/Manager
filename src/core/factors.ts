/**
 * Einflussfaktoren: which properties of a reel go along with more or fewer views. Compares the
 * median views of each group with the median of all reels. Rule-based, no AI; with few reels
 * every finding is marked as uncertain. Pure logic, no browser APIs.
 */
import type { Post } from '@/data/schemas';
import { valueAtAge } from './postHistory';

export const FACTOR_KEYS = [
  'weekday',
  'timeOfDay',
  'hookType',
  'series',
  'captionLength',
  'hashtags',
  'watchTime',
  'length',
  'gap',
] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

/** Group keys per factor in display order (weekday: ISO 1–7; hook types and series: free). */
export const FACTOR_GROUPS = {
  timeOfDay: ['morning', 'midday', 'afternoon', 'evening', 'night'],
  captionLength: ['short', 'medium', 'long'],
  hashtags: ['none', 'few', 'many'],
  watchTime: ['low', 'mid', 'high'],
  length: ['xs', 'short', 'mid', 'long'],
  gap: ['daily', 'short', 'long'],
} as const;

/** Reels younger than this are not compared (their views are still growing fast). */
export const MIN_AGE_HOURS = 48;
/** Below this number of reels in total, nothing is evaluated. */
export const MIN_REELS = 4;
/** Findings are only "sicher" with this many reels in the group and this many in total. */
export const SURE_GROUP = 3;
export const SURE_TOTAL = 8;
/** A group counts as notable from 25 % above or 20 % below the median. */
const HIGH = 1.25;
const LOW = 0.8;

const HOUR = 60 * 60 * 1000;

export interface FactorGroup {
  key: string;
  posts: number;
  medianViews: number;
  /** Median of the group / median of all reels. */
  ratio: number;
  /** Likes, comments, shares and saves per 1,000 views (only reels with values). */
  interactionsPer1000?: number;
  /** New followers per 1,000 views (only posts with both values, e.g. YouTube). */
  followersPer1000?: number;
}

export interface FactorResult {
  factor: FactorKey;
  groups: FactorGroup[];
}

export interface Finding {
  factor: FactorKey;
  key: string;
  ratio: number;
  posts: number;
  /** Too few reels to be sure. */
  uncertain: boolean;
}

export interface FactorAnalysis {
  /** Reels that were compared. */
  reels: number;
  /** Reels left out because they are younger than 48 hours. */
  tooYoung: number;
  /** Reels whose views are the value after about 7 days (from the Verlauf). */
  atSevenDays: number;
  medianViews: number;
  enough: boolean;
  factors: FactorResult[];
  /** Notable groups, strongest first (max. 6). */
  findings: Finding[];
}

export const FACTOR_PLATFORMS = ['instagram', 'youtube'] as const;
export type FactorPlatform = (typeof FACTOR_PLATFORMS)[number];

/** Short videos compared per platform: Instagram reels, YouTube Shorts. */
export function isFactorPost(post: Post, platform: FactorPlatform): boolean {
  return platform === 'instagram'
    ? post.platform === 'instagram' && post.format === 'reel'
    : post.platform === 'youtube' && post.format === 'short';
}

export interface FactorOptions {
  now: Date;
  /** Series of a post (from its video package). */
  seriesOf?: (post: Post) => string | undefined;
  /** Instagram reels (default) or YouTube Shorts. */
  platform?: FactorPlatform;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** ISO weekday (1 = Monday) of a calendar date "JJJJ-MM-TT". */
function weekdayOf(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Local time of day of the publishing time. */
export function timeOfDay(publishedAt: string): (typeof FACTOR_GROUPS.timeOfDay)[number] {
  const hour = new Date(publishedAt).getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function captionGroup(length: number) {
  return length < 80 ? 'short' : length < 250 ? 'medium' : 'long';
}

function hashtagGroup(count: number) {
  return count === 0 ? 'none' : count <= 3 ? 'few' : 'many';
}

function watchGroup(seconds: number) {
  return seconds < 4 ? 'low' : seconds < 8 ? 'mid' : 'high';
}

function lengthGroup(seconds: number) {
  return seconds < 30 ? 'xs' : seconds < 60 ? 'short' : seconds < 90 ? 'mid' : 'long';
}

function gapGroup(days: number) {
  return days <= 1 ? 'daily' : days <= 3 ? 'short' : 'long';
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / (24 * HOUR);

/** Comparable views: the value after ~7 days if known, else the current one (≥ 48 h old). */
function comparableViews(
  post: Post,
  now: Date,
): { views?: number; atSeven: boolean; young: boolean } {
  if (post.publishedAt) {
    const seven = valueAtAge(post.history, post.publishedAt, 168);
    if (seven !== undefined) return { views: seven, atSeven: true, young: false };
  }
  const start = post.publishedAt
    ? Date.parse(post.publishedAt)
    : Date.parse(`${post.date}T12:00:00Z`);
  const measured = Date.parse(post.measuredAt ?? now.toISOString());
  const age = (Math.min(measured, now.getTime()) - start) / HOUR;
  if (age < MIN_AGE_HOURS) return { atSeven: false, young: true };
  return { views: post.views, atSeven: false, young: false };
}

function interactions(post: Post): number | undefined {
  const values = [post.likes, post.comments, post.shares, post.saves];
  if (values.every((value) => value === undefined)) return undefined;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

const strength = (finding: Pick<Finding, 'ratio' | 'posts'>) =>
  Math.abs(Math.log(Math.max(finding.ratio, 0.01))) * Math.sqrt(finding.posts);

/** Analyses the Instagram reels: median views per group of each factor. */
export function analyzeFactors(posts: readonly Post[], options: FactorOptions): FactorAnalysis {
  const reels = posts
    .filter((post) => isFactorPost(post, options.platform ?? 'instagram'))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Days since the previous reel (posting rhythm), from all reels.
  const gaps = new Map<string, number>();
  reels.forEach((post, index) => {
    const previous = reels[index - 1];
    if (previous) gaps.set(post.id, Math.round(dayNumber(post.date) - dayNumber(previous.date)));
  });

  let tooYoung = 0;
  let atSevenDays = 0;
  const rows: { post: Post; views: number }[] = [];
  for (const post of reels) {
    const result = comparableViews(post, options.now);
    if (result.young) tooYoung += 1;
    if (result.views === undefined) continue;
    if (result.atSeven) atSevenDays += 1;
    rows.push({ post, views: result.views });
  }

  const overall = rows.length ? median(rows.map((row) => row.views)) : 0;
  const enough = rows.length >= MIN_REELS && overall > 0;

  const keyOf: Record<FactorKey, (post: Post) => string | undefined> = {
    weekday: (post) => String(weekdayOf(post.date)),
    timeOfDay: (post) => (post.publishedAt ? timeOfDay(post.publishedAt) : undefined),
    hookType: (post) => post.hookType,
    series: (post) => options.seriesOf?.(post),
    captionLength: (post) =>
      post.captionLength === undefined ? undefined : captionGroup(post.captionLength),
    hashtags: (post) =>
      post.hashtagCount === undefined ? undefined : hashtagGroup(post.hashtagCount),
    length: (post) => {
      const seconds = post.retention?.lengthSeconds;
      return seconds === undefined ? undefined : lengthGroup(seconds);
    },
    watchTime: (post) =>
      post.avgWatchSeconds === undefined ? undefined : watchGroup(post.avgWatchSeconds),
    gap: (post) => {
      const gap = gaps.get(post.id);
      return gap === undefined ? undefined : gapGroup(gap);
    },
  };

  const factors: FactorResult[] = enough
    ? FACTOR_KEYS.map((factor) => {
        const byKey = new Map<string, { post: Post; views: number }[]>();
        for (const row of rows) {
          const key = keyOf[factor](row.post);
          if (key === undefined) continue;
          byKey.set(key, [...(byKey.get(key) ?? []), row]);
        }
        const order: readonly string[] =
          factor in FACTOR_GROUPS ? FACTOR_GROUPS[factor as keyof typeof FACTOR_GROUPS] : [];
        const groups = [...byKey.entries()].map(([key, items]): FactorGroup => {
          const withInteractions = items.flatMap(({ post, views }) => {
            const value = interactions(post);
            return value === undefined || views <= 0 ? [] : [{ value, views }];
          });
          const sumViews = withInteractions.reduce((sum, item) => sum + item.views, 0);
          const withFollowers = items.filter(
            ({ post, views }) => post.newFollowers !== undefined && views > 0,
          );
          const followerViews = withFollowers.reduce((sum, item) => sum + item.views, 0);
          const medianViews = median(items.map((item) => item.views));
          return {
            key,
            posts: items.length,
            medianViews,
            ratio: medianViews / overall,
            ...(sumViews > 0
              ? {
                  interactionsPer1000:
                    (withInteractions.reduce((sum, item) => sum + item.value, 0) / sumViews) * 1000,
                }
              : {}),
            ...(followerViews > 0
              ? {
                  followersPer1000:
                    (withFollowers.reduce((sum, item) => sum + (item.post.newFollowers ?? 0), 0) /
                      followerViews) *
                    1000,
                }
              : {}),
          };
        });
        groups.sort((a, b) =>
          factor === 'weekday'
            ? Number(a.key) - Number(b.key)
            : order.length
              ? order.indexOf(a.key) - order.indexOf(b.key)
              : b.medianViews - a.medianViews,
        );
        return { factor, groups };
      }).filter((result) => result.groups.length >= 2)
    : [];

  const findings: Finding[] = factors
    .flatMap(({ factor, groups }) =>
      groups
        .filter((group) => group.posts >= 2 && (group.ratio >= HIGH || group.ratio <= LOW))
        .map((group) => ({
          factor,
          key: group.key,
          ratio: group.ratio,
          posts: group.posts,
          uncertain: group.posts < SURE_GROUP || rows.length < SURE_TOTAL,
        })),
    )
    .sort((a, b) => strength(b) - strength(a))
    .slice(0, 6);

  return {
    reels: rows.length,
    tooYoung,
    atSevenDays,
    medianViews: overall,
    enough,
    factors,
    findings,
  };
}
