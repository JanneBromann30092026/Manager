/**
 * Instagram (read only, Instagram API with Instagram Login): own profile, reels and their
 * insights. Long-lived token (60 days) created in the Meta dashboard, refreshed by the app
 * (no app secret needed). New followers per reel and the non-follower share are not offered by
 * the API – they stay empty (form or screenshot).
 */
import { z } from 'zod';
import type { ApiDraft } from './apiImport';
import { localDateOf } from './dates';

export const IG_API = 'https://graph.instagram.com/v24.0';
export const IG_REFRESH_URL = 'https://graph.instagram.com/refresh_access_token';

/** Long-lived tokens live 60 days; Meta refreshes only tokens that are at least 24 h old. */
export const TOKEN_LIFETIME_DAYS = 60;
export const TOKEN_WARN_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/** Automatic fetch when the app is opened, at most this often. */
export const AUTO_SYNC_HOURS = 6;

/** Is an automatic fetch due (never fetched, or longer ago than 6 hours)? */
export function isSyncDue(lastSyncAt: string, now: Date, hours = AUTO_SYNC_HOURS): boolean {
  const last = Date.parse(lastSyncAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= hours * 60 * 60 * 1000 || last > now.getTime();
}

export const REEL_METRICS = [
  'views',
  'reach',
  'likes',
  'comments',
  'shares',
  'saved',
  'ig_reels_avg_watch_time',
] as const;

const count = z.coerce.number().int().min(0).optional();

export const profileSchema = z.object({
  user_id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  username: z.string().optional(),
  account_type: z.string().optional(),
  followers_count: count,
  media_count: count,
});
export type InstagramProfile = z.output<typeof profileSchema>;

export const mediaPageSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        caption: z.string().optional(),
        media_type: z.string().optional(),
        media_product_type: z.string().optional(),
        timestamp: z.string(),
      }),
    )
    .default([]),
  paging: z.object({ next: z.string().optional() }).optional(),
});
export type InstagramMedia = z.output<typeof mediaPageSchema>['data'][number];

export const insightsSchema = z.object({
  data: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.object({ value: z.unknown() })).optional(),
        total_value: z.object({ value: z.unknown() }).optional(),
      }),
    )
    .default([]),
});
export type InstagramInsights = z.output<typeof insightsSchema>;

export const refreshSchema = z.object({
  access_token: z.string().min(10),
  expires_in: z.coerce.number().positive().optional(),
});

export const errorSchema = z.object({
  error: z.object({ code: z.number().optional(), type: z.string().optional() }),
});

/** Stored encrypted as one secret. */
export const tokenRecordSchema = z.object({
  accessToken: z.string().min(10).max(2000),
  savedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  username: z.string().max(100).optional(),
});
export type TokenRecord = z.output<typeof tokenRecordSchema>;

/** A pasted token: trimmed, no spaces or quotes; Instagram tokens start with "IG". */
export function cleanToken(text: string): string | undefined {
  const token = text.trim().replace(/^["']|["']$/g, '');
  return /^IG[A-Za-z0-9_-]{20,}$/.test(token) ? token : undefined;
}

export function newTokenRecord(
  accessToken: string,
  now: Date,
  expiresInSeconds?: number,
): TokenRecord {
  const lifetime = expiresInSeconds ? expiresInSeconds * 1000 : TOKEN_LIFETIME_DAYS * DAY;
  return {
    accessToken,
    savedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetime).toISOString(),
  };
}

export interface TokenStatus {
  daysLeft: number;
  expired: boolean;
  /** Expires within a week: remind. */
  warn: boolean;
  /** Older than 24 h: Meta accepts a refresh. */
  canRefresh: boolean;
}

export function tokenStatus(
  record: Pick<TokenRecord, 'savedAt' | 'expiresAt'>,
  now: Date,
): TokenStatus {
  const left = Date.parse(record.expiresAt) - now.getTime();
  const age = now.getTime() - Date.parse(record.savedAt);
  return {
    daysLeft: Math.max(0, Math.floor(left / DAY)),
    expired: left <= 0,
    warn: left <= TOKEN_WARN_DAYS * DAY,
    canRefresh: left > 0 && age >= DAY,
  };
}

/** Refresh automatically once the token is older than a day (keeps it alive while in use). */
export function shouldAutoRefresh(
  record: Pick<TokenRecord, 'savedAt' | 'expiresAt'>,
  now: Date,
): boolean {
  return tokenStatus(record, now).canRefresh;
}

function numberOf(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Metric name → value (lifetime value or total value). */
export function insightValues(insights: InstagramInsights): Map<string, number> {
  const result = new Map<string, number>();
  for (const metric of insights.data) {
    const value = numberOf(metric.total_value?.value ?? metric.values?.[0]?.value);
    if (value !== undefined) result.set(metric.name, value);
  }
  return result;
}

export function isReel(media: InstagramMedia): boolean {
  return media.media_product_type === 'REELS';
}

/** Caption length (characters) and number of hashtags; the caption itself is not stored. */
export function captionStats(caption: string | undefined): {
  captionLength?: number;
  hashtagCount?: number;
} {
  if (caption === undefined) return {};
  return {
    captionLength: [...caption.trim()].length,
    hashtagCount: caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0,
  };
}

/** Topic from the caption: first line without hashtags and mentions. */
export function topicFromCaption(caption: string | undefined): string | undefined {
  const line = (caption ?? '')
    .split(/\r?\n/)
    .map((part) =>
      part
        .replace(/[#@][\p{L}\p{N}_.]+/gu, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .find(Boolean);
  if (!line) return undefined;
  return line.length > 160 ? `${line.slice(0, 159)}…` : line;
}

export function reelToDraft(media: InstagramMedia, insights?: Map<string, number>): ApiDraft {
  const published = new Date(media.timestamp);
  const avgMs = insights?.get('ig_reels_avg_watch_time');
  return {
    externalId: media.id,
    date: Number.isNaN(published.getTime()) ? media.timestamp.slice(0, 10) : localDateOf(published),
    platform: 'instagram',
    format: 'reel',
    topic: topicFromCaption(media.caption),
    ...(Number.isNaN(published.getTime()) ? {} : { publishedAt: published.toISOString() }),
    ...captionStats(media.caption),
    views: insights?.get('views'),
    reach: insights?.get('reach'),
    likes: insights?.get('likes'),
    comments: insights?.get('comments'),
    shares: insights?.get('shares'),
    saves: insights?.get('saved'),
    // Instagram reports the average watch time in milliseconds.
    avgWatchSeconds: avgMs === undefined ? undefined : Math.round(avgMs / 100) / 10,
  };
}
