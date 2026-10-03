/**
 * Verlauf of a post: the values at each API fetch. From it the app reads how a reel developed
 * after 1, 3 and 7 days. Pure logic, no browser APIs.
 */

export interface PostSnapshot {
  at: string;
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  avgWatchSeconds?: number;
}

export const SNAPSHOT_FIELDS = [
  'views',
  'reach',
  'likes',
  'comments',
  'shares',
  'saves',
  'avgWatchSeconds',
] as const;
export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

/** Milestones in hours after publishing: 1, 3 and 7 days. */
export const MILESTONE_HOURS = [24, 72, 168] as const;

const HOUR = 60 * 60 * 1000;
/** Fetches closer together than this replace the last snapshot instead of adding one. */
const MIN_GAP_HOURS = 1;

/** Snapshot from known values (unknown values stay out). */
export function snapshotOf(
  values: Partial<Record<SnapshotField, number>>,
  at: string,
): PostSnapshot {
  const snapshot: PostSnapshot = { at };
  for (const field of SNAPSHOT_FIELDS) {
    const value = values[field];
    if (value !== undefined) snapshot[field] = value;
  }
  return snapshot;
}

const hasValues = (snapshot: PostSnapshot) =>
  SNAPSHOT_FIELDS.some((field) => snapshot[field] !== undefined);

/**
 * Adds a snapshot (sorted by time). A snapshot within an hour of the previous one replaces it;
 * beyond `max` the snapshot closest to its neighbours is dropped, so first, last and the
 * spread over time stay.
 */
export function appendSnapshot(
  history: readonly PostSnapshot[],
  snapshot: PostSnapshot,
  max: number,
): PostSnapshot[] {
  if (!hasValues(snapshot)) return [...history];
  const time = Date.parse(snapshot.at);
  const next = history.filter(
    (entry) => Math.abs(Date.parse(entry.at) - time) >= MIN_GAP_HOURS * HOUR,
  );
  next.push(snapshot);
  next.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  while (next.length > Math.max(2, max)) {
    let drop = 1;
    let smallest = Infinity;
    for (let i = 1; i < next.length - 1; i += 1) {
      const gap = Date.parse(next[i + 1]!.at) - Date.parse(next[i - 1]!.at);
      if (gap < smallest) {
        smallest = gap;
        drop = i;
      }
    }
    next.splice(drop, 1);
  }
  return next;
}

/**
 * Value of a field about `hours` after publishing: the snapshot closest to that age, if one lies
 * between 75 % and 150 % of it. Otherwise unknown (never interpolated).
 */
export function valueAtAge(
  history: readonly PostSnapshot[],
  publishedAt: string,
  hours: number,
  field: SnapshotField = 'views',
): number | undefined {
  const start = Date.parse(publishedAt);
  if (Number.isNaN(start)) return undefined;
  let best: { distance: number; value: number } | undefined;
  for (const entry of history) {
    const value = entry[field];
    if (value === undefined) continue;
    const age = (Date.parse(entry.at) - start) / HOUR;
    if (age < hours * 0.75 || age > hours * 1.5) continue;
    const distance = Math.abs(age - hours);
    if (!best || distance < best.distance) best = { distance, value };
  }
  return best?.value;
}
