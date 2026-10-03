/**
 * YouTube read only: own channel, uploads, statistics (Data API v3) and per-video average view
 * duration / subscribers gained (Analytics API). Never uploads or changes anything.
 */
import {
  analyticsByVideo,
  analyticsResponseSchema,
  channelResponseSchema,
  chunk,
  playlistResponseSchema,
  videosResponseSchema,
  videoToDraft,
  type VideoAnalytics,
  type YouTubeDraft,
} from '@/core/youtube';
import { localDateOf } from '@/core/dates';
import type { z } from 'zod';

const DATA_API = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2/reports';
/** The newest videos are enough for the evaluation (two pages of the uploads list). */
const MAX_VIDEOS = 100;

export type YouTubeErrorReason =
  'auth' | 'notEnabled' | 'forbidden' | 'noChannel' | 'network' | 'failed';

export class YouTubeError extends Error {
  constructor(readonly reason: YouTubeErrorReason) {
    super(`YouTube request failed: ${reason}`);
    this.name = 'YouTubeError';
  }
}

async function getJson<S extends z.ZodType>(
  url: string,
  token: string,
  schema: S,
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new YouTubeError('network');
  }
  if (response.status === 401) throw new YouTubeError('auth');
  if (response.status === 403) {
    const body = await response.text().catch(() => '');
    throw new YouTubeError(
      /accessNotConfigured|SERVICE_DISABLED|has not been used/.test(body)
        ? 'notEnabled'
        : 'forbidden',
    );
  }
  if (!response.ok) throw new YouTubeError('failed');
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new YouTubeError('failed');
  return parsed.data;
}

export interface YouTubeChannel {
  id: string;
  title?: string;
  subscribers?: number;
  uploads: string;
}

export async function fetchChannel(token: string): Promise<YouTubeChannel> {
  const data = await getJson(
    `${DATA_API}/channels?part=id,snippet,statistics,contentDetails&mine=true`,
    token,
    channelResponseSchema,
  );
  const channel = data.items[0];
  if (!channel) throw new YouTubeError('noChannel');
  return {
    id: channel.id,
    title: channel.snippet?.title,
    subscribers: channel.statistics?.hiddenSubscriberCount
      ? undefined
      : channel.statistics?.subscriberCount,
    uploads: channel.contentDetails.relatedPlaylists.uploads,
  };
}

async function fetchVideoIds(token: string, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await getJson(
      `${DATA_API}/playlistItems?${params}`,
      token,
      playlistResponseSchema,
    );
    ids.push(...page.items.map((item) => item.contentDetails.videoId));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_VIDEOS);
  return ids.slice(0, MAX_VIDEOS);
}

async function fetchAnalytics(
  token: string,
  ids: readonly string[],
  startDate: string,
): Promise<Map<string, VideoAnalytics>> {
  const result = new Map<string, VideoAnalytics>();
  for (const part of chunk(ids, 50)) {
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate,
      endDate: localDateOf(),
      metrics: 'averageViewDuration,subscribersGained',
      dimensions: 'video',
      filters: `video==${part.join(',')}`,
      maxResults: '50',
    });
    const data = await getJson(`${ANALYTICS_API}?${params}`, token, analyticsResponseSchema);
    for (const [id, values] of analyticsByVideo(data)) result.set(id, values);
  }
  return result;
}

export interface YouTubeFetchResult {
  channel: YouTubeChannel;
  drafts: YouTubeDraft[];
  /** The Analytics API failed (data API values were still read). */
  analyticsFailed: YouTubeErrorReason | null;
}

/** Reads the channel and its newest videos with statistics. */
export async function fetchYouTube(token: string): Promise<YouTubeFetchResult> {
  const channel = await fetchChannel(token);
  const ids = await fetchVideoIds(token, channel.uploads);
  const videos = [];
  for (const part of chunk(ids, 50)) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: part.join(','),
      maxResults: '50',
    });
    const data = await getJson(`${DATA_API}/videos?${params}`, token, videosResponseSchema);
    videos.push(...data.items);
  }
  let analytics = new Map<string, VideoAnalytics>();
  let analyticsFailed: YouTubeErrorReason | null = null;
  if (videos.length > 0) {
    const first = videos.map((video) => video.snippet.publishedAt.slice(0, 10)).sort()[0]!;
    try {
      analytics = await fetchAnalytics(token, ids, first);
    } catch (error: unknown) {
      if (error instanceof YouTubeError && error.reason === 'auth') throw error;
      analyticsFailed = error instanceof YouTubeError ? error.reason : 'failed';
    }
  }
  return {
    channel,
    drafts: videos.map((video) => videoToDraft(video, analytics.get(video.id))),
    analyticsFailed,
  };
}
