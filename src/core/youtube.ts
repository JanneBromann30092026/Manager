/**
 * YouTube (read only): maps YouTube Data API v3 and YouTube Analytics API answers to posts.
 * Data API: title, publish date, duration, views, likes, comments. Analytics: average view
 * duration and subscribers gained per video. Values YouTube does not deliver stay empty.
 */
import { z } from 'zod';
import type { Post } from '@/data/schemas';
import { normalizeKey, type MergePlan, type PostDraft } from './csvImport';
import { localDateOf } from './dates';

/** Shorts can be up to 3 minutes long (since October 2024). */
export const SHORTS_MAX_SECONDS = 180;

const countText = z.coerce.number().int().min(0).optional();

export const channelResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ title: z.string() }).partial().optional(),
        statistics: z
          .object({ subscriberCount: countText, hiddenSubscriberCount: z.boolean().optional() })
          .optional(),
        contentDetails: z.object({
          relatedPlaylists: z.object({ uploads: z.string() }),
        }),
      }),
    )
    .default([]),
});
export type ChannelResponse = z.output<typeof channelResponseSchema>;

export const playlistResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(z.object({ contentDetails: z.object({ videoId: z.string() }) })).default([]),
});

export const videosResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ title: z.string(), publishedAt: z.string() }),
        contentDetails: z.object({ duration: z.string() }).partial().optional(),
        statistics: z
          .object({ viewCount: countText, likeCount: countText, commentCount: countText })
          .optional(),
      }),
    )
    .default([]),
});
export type YouTubeVideo = z.output<typeof videosResponseSchema>['items'][number];

export const analyticsResponseSchema = z.object({
  columnHeaders: z.array(z.object({ name: z.string() })).default([]),
  rows: z.array(z.array(z.union([z.string(), z.number()]))).default([]),
});
export type AnalyticsResponse = z.output<typeof analyticsResponseSchema>;

export interface VideoAnalytics {
  avgWatchSeconds?: number;
  subscribersGained?: number;
}

/** ISO 8601 duration ("PT1M5S") → seconds; undefined if not parseable. */
export function parseIsoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match || value === 'P' || value === 'PT') return undefined;
  const [, days, hours, minutes, seconds] = match;
  return Math.round(
    Number(days ?? 0) * 86400 +
      Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0),
  );
}

/** Analytics rows by video id (columns are found by name, not by position). */
export function analyticsByVideo(response: AnalyticsResponse): Map<string, VideoAnalytics> {
  const index = (name: string) =>
    response.columnHeaders.findIndex((column) => column.name === name);
  const video = index('video');
  const avg = index('averageViewDuration');
  const subs = index('subscribersGained');
  const result = new Map<string, VideoAnalytics>();
  if (video < 0) return result;
  const num = (row: (string | number)[], at: number) => {
    if (at < 0) return undefined;
    const value = Number(row[at]);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
  };
  for (const row of response.rows) {
    result.set(String(row[video]), {
      avgWatchSeconds: num(row, avg),
      subscribersGained: num(row, subs),
    });
  }
  return result;
}

export interface YouTubeDraft extends PostDraft {
  externalId: string;
}

/** One post draft per video (publish date in local time). */
export function videoToDraft(video: YouTubeVideo, analytics?: VideoAnalytics): YouTubeDraft {
  const length = parseIsoDuration(video.contentDetails?.duration);
  const isShort =
    /#shorts?\b/i.test(video.snippet.title) ||
    (length !== undefined && length <= SHORTS_MAX_SECONDS);
  const published = new Date(video.snippet.publishedAt);
  return {
    externalId: video.id,
    date: Number.isNaN(published.getTime())
      ? video.snippet.publishedAt.slice(0, 10)
      : localDateOf(published),
    platform: 'youtube',
    format: isShort ? 'short' : 'video',
    topic: video.snippet.title.trim().slice(0, 160) || undefined,
    views: video.statistics?.viewCount,
    likes: video.statistics?.likeCount,
    comments: video.statistics?.commentCount,
    avgWatchSeconds: analytics?.avgWatchSeconds,
    newFollowers: analytics?.subscribersGained,
    retention: length !== undefined ? { lengthSeconds: length } : undefined,
  };
}

type Target = Pick<Post, 'id' | 'date' | 'platform' | 'topic'> & { externalId?: string };

/**
 * Matches each video to an existing post: same YouTube id, else same day + YouTube + title
 * (e.g. entered by hand before). The rest is new.
 */
export function planYouTubeImport<T extends Target>(
  existing: readonly T[],
  drafts: readonly YouTubeDraft[],
): MergePlan<T>[] {
  return drafts.map((draft) => {
    const target =
      existing.find((post) => post.externalId === draft.externalId) ??
      existing.find(
        (post) =>
          !post.externalId &&
          post.platform === 'youtube' &&
          post.date === draft.date &&
          post.topic !== undefined &&
          draft.topic !== undefined &&
          normalizeKey(post.topic) === normalizeKey(draft.topic),
      );
    return target ? { kind: 'update', target, draft } : { kind: 'create', draft };
  });
}

/** Video ids in chunks (the APIs take at most 50 ids per call). */
export function chunk<T>(items: readonly T[], size = 50): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
