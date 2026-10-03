/**
 * CSV export of the numbers (posts and follower counts). German Excel/Numbers style: ";" as
 * separator, decimal comma, UTF-8 with BOM. The post columns use the names the CSV import
 * recognizes, so an export can be imported again (computed columns are reported as ignored).
 */
import type { HookType } from '@/data/domain';
import type { AccountStat, Post } from '@/data/schemas';
import { followersPer1000 } from './metrics';

const BOM = '﻿';
const SEPARATOR = ';';

const HOOK_EXPORT: Record<HookType, string> = {
  question: 'Frage',
  number: 'Zahl',
  contradiction: 'Widerspruch',
  other: 'Sonstige',
};

function number(value: number | undefined): string {
  if (value === undefined) return '';
  return String(value).replace('.', ',');
}

/** Quotes a cell when needed; leading = + - @ are defused against formula injection. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header: readonly string[], rows: readonly string[][]): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(SEPARATOR));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export const POST_CSV_HEADER = [
  'Datum',
  'Plattform',
  'Format',
  'Thema',
  'Hook',
  'Aufrufe',
  'Nicht-Follower (%)',
  'Wiedergabedauer (s)',
  'Likes',
  'Kommentare',
  'Shares',
  'Saves',
  'Neue Follower',
  'Follower pro 1.000 Aufrufe',
  'Länge (s)',
  'Sek. bis 50 %',
  'Halten am Ende (%)',
  'Stories',
  'Reels',
  'Feed',
  'Profil',
  'Explore',
  'Stand',
  'Quelle',
  'Notizen',
] as const;

/** Posts sorted by date (oldest first). Unknown values stay empty cells. */
export function postsToCsv(posts: readonly Post[]): string {
  const rows = [...posts]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((post) => {
      const retention = post.retention;
      const sources = retention?.sources;
      return [
        post.date,
        post.platform,
        post.format,
        post.topic ?? '',
        post.hookType ? HOOK_EXPORT[post.hookType] : '',
        number(post.views),
        number(post.nonFollowerPct),
        number(post.avgWatchSeconds),
        number(post.likes),
        number(post.comments),
        number(post.shares),
        number(post.saves),
        number(post.newFollowers),
        number(followersPer1000(post.newFollowers, post.views)),
        number(retention?.lengthSeconds),
        number(retention?.halfGoneSeconds),
        number(retention?.endHoldPct),
        number(sources?.stories),
        number(sources?.reelsTab),
        number(sources?.feed),
        number(sources?.profile),
        number(sources?.explore),
        post.measuredAt,
        post.source,
        post.notes ?? '',
      ];
    });
  return toCsv(POST_CSV_HEADER, rows);
}

export const FOLLOWER_CSV_HEADER = [
  'Datum',
  'Plattform',
  'Follower',
  'Aufrufe 30 Tage',
  'Neue Follower 30 Tage',
  'Aufrufe 7 Tage',
  'Nicht-Follower 7 Tage (%)',
  'Quelle',
  'Notizen',
] as const;

export function followersToCsv(stats: readonly AccountStat[]): string {
  const rows = [...stats]
    .sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform))
    .map((stat) => [
      stat.date,
      stat.platform,
      number(stat.followers),
      number(stat.views30d),
      number(stat.newFollowers30d),
      number(stat.views7d),
      number(stat.nonFollowerPct7d),
      stat.source,
      stat.notes ?? '',
    ]);
  return toCsv(FOLLOWER_CSV_HEADER, rows);
}
