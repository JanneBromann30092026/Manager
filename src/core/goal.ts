/**
 * Goal progress (500 Instagram followers by 31.12.2026): needed weekly pace vs. the pace of the
 * last 4 weeks. Honest: if the current pace misses the goal, the status says so.
 */
import { addDays, daysBetween } from './dates';
import { round1, type PostNumbers } from './metrics';

export interface FollowerSnapshot {
  date: string;
  followers: number;
  /** Optional 30-day value from the insights (used for the pace when there is no history). */
  newFollowers30d?: number;
}

export type GoalStatus = 'reached' | 'onTrack' | 'behind' | 'unknown';
export type PaceSource = 'snapshots' | 'insights' | 'posts';

export interface GoalProgress {
  target: number;
  deadline: string;
  current: number | undefined;
  /** Date of the follower count used. */
  asOf: string | undefined;
  remaining: number | undefined;
  weeksLeft: number;
  neededPerWeek: number | undefined;
  pacePerWeek: number | undefined;
  paceSource: PaceSource | undefined;
  /** Followers at the deadline if the pace stays the same. */
  projected: number | undefined;
  /** 0..1 */
  fraction: number;
  status: GoalStatus;
}

const PACE_DAYS = 28;

function latest(
  snapshots: readonly FollowerSnapshot[],
  today: string,
): FollowerSnapshot | undefined {
  return [...snapshots]
    .filter((snapshot) => snapshot.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Pace from the follower history: the snapshot closest to 4 weeks before the latest one. */
function paceFromSnapshots(
  snapshots: readonly FollowerSnapshot[],
  last: FollowerSnapshot,
): number | undefined {
  const target = addDays(last.date, -PACE_DAYS);
  const base = snapshots
    .filter((snapshot) => daysBetween(snapshot.date, last.date) >= 7)
    .sort(
      (a, b) =>
        Math.abs(daysBetween(a.date, target)) - Math.abs(daysBetween(b.date, target)) ||
        b.date.localeCompare(a.date),
    )[0];
  if (!base) return undefined;
  const weeks = daysBetween(base.date, last.date) / 7;
  return round1((last.followers - base.followers) / weeks);
}

export function goalProgress(input: {
  target: number;
  deadline: string;
  today: string;
  snapshots: readonly FollowerSnapshot[];
  /** Posts of the goal platform (fallback for the pace). */
  posts: readonly PostNumbers[];
}): GoalProgress {
  const { target, deadline, today, snapshots, posts } = input;
  const weeksLeft = Math.max(0, daysBetween(today, deadline)) / 7;
  const last = latest(snapshots, today);
  const current = last?.followers;
  const remaining = current === undefined ? undefined : Math.max(0, target - current);

  let pacePerWeek: number | undefined;
  let paceSource: PaceSource | undefined;
  if (last) {
    pacePerWeek = paceFromSnapshots(snapshots, last);
    if (pacePerWeek !== undefined) paceSource = 'snapshots';
    else if (last.newFollowers30d !== undefined) {
      pacePerWeek = round1(last.newFollowers30d / (30 / 7));
      paceSource = 'insights';
    }
  }
  if (pacePerWeek === undefined) {
    const recent = posts.filter(
      (post) => post.date > addDays(today, -PACE_DAYS) && post.date <= today,
    );
    const known = recent.filter((post) => post.newFollowers !== undefined);
    if (known.length > 0) {
      pacePerWeek = round1(known.reduce((sum, post) => sum + (post.newFollowers ?? 0), 0) / 4);
      paceSource = 'posts';
    }
  }

  let neededPerWeek: number | undefined;
  if (remaining !== undefined) {
    neededPerWeek = remaining === 0 ? 0 : weeksLeft > 0 ? round1(remaining / weeksLeft) : remaining;
  }
  const projected =
    current !== undefined && pacePerWeek !== undefined
      ? Math.round(current + pacePerWeek * weeksLeft)
      : undefined;

  let status: GoalStatus = 'unknown';
  if (remaining === 0) status = 'reached';
  else if (neededPerWeek !== undefined && pacePerWeek !== undefined) {
    status = pacePerWeek >= neededPerWeek && weeksLeft > 0 ? 'onTrack' : 'behind';
  } else if (remaining !== undefined && weeksLeft === 0) status = 'behind';

  return {
    target,
    deadline,
    current,
    asOf: last?.date,
    remaining,
    weeksLeft: round1(weeksLeft),
    neededPerWeek,
    pacePerWeek,
    paceSource,
    projected,
    fraction: current === undefined ? 0 : Math.min(1, current / target),
    status,
  };
}
