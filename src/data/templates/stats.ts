/** Labels and start values of „Zahlen & Auswertung“ (step 7). */
import type { Format, Platform, ValueSource } from '../domain';

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export const FORMAT_LABELS: Record<Format, string> = {
  reel: 'Reel',
  story: 'Story',
  video: 'YouTube-Video',
  short: 'Short',
  podcast: 'Podcast-Folge',
  clip: 'Podcast-Clip',
};

export const VALUE_SOURCE_LABELS: Record<ValueSource, string> = {
  manual: 'eingetragen',
  screenshot: 'abgelesen',
  csv: 'CSV-Import',
  youtubeApi: 'YouTube API',
  instagramApi: 'Instagram API',
};

/** Traffic sources of a reel (Instagram insights), in display order. */
export const TRAFFIC_SOURCE_KEYS = ['stories', 'reelsTab', 'feed', 'profile', 'explore'] as const;
export const TRAFFIC_SOURCE_LABELS: Record<(typeof TRAFFIC_SOURCE_KEYS)[number], string> = {
  stories: 'Stories',
  reelsTab: 'Reels-Tab',
  feed: 'Feed',
  profile: 'Profil',
  explore: 'Explore',
};

/**
 * Start values from 28.09.2026 (docs/INHALTE.md, „Ausgangslage“) – imported once as the first
 * follower count, so goal progress has a starting point.
 */
export const BASELINE_STATS = {
  date: '2026-09-28',
  platform: 'instagram',
  followers: 109,
  views30d: 9190,
  newFollowers30d: 45,
  views7d: 2609,
  nonFollowerPct7d: 53,
  notes: 'Startwerte (Ausgangslage): 6 Reels; 7 Tage: Reels 59 %, Stories 41 % der Aufrufe.',
} as const;
