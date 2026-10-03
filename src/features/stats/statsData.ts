import { useMemo } from 'react';
import { localDateOf } from '@/core/dates';
import { goalProgress, type GoalProgress } from '@/core/goal';
import type { AccountStat, Post } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { GOAL_DEFAULTS } from '@/data/templates';

/** "28.09.2026" */
export function formatDay(date: string): string {
  return date.split('-').reverse().join('.');
}

/** German number with at most one decimal; unknown → "–". */
export function formatNumber(value: number | undefined): string {
  return value === undefined ? '–' : value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

export function usePosts(): Post[] {
  const map = useDataStore((s) => s.posts);
  return useMemo(
    () =>
      Object.values(map).sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
    [map],
  );
}

export function useAccountStats(): AccountStat[] {
  const map = useDataStore((s) => s.accountStats);
  return useMemo(() => Object.values(map).sort((a, b) => b.date.localeCompare(a.date)), [map]);
}

/** Goal progress for today from follower counts and posts of the goal platform. */
export function useGoal(today: string = localDateOf()): GoalProgress {
  const posts = usePosts();
  const stats = useAccountStats();
  return useMemo(
    () =>
      goalProgress({
        target: GOAL_DEFAULTS.followers,
        deadline: GOAL_DEFAULTS.deadline,
        today,
        snapshots: stats.filter((stat) => stat.platform === GOAL_DEFAULTS.platform),
        posts: posts.filter((post) => post.platform === GOAL_DEFAULTS.platform),
      }),
    [posts, stats, today],
  );
}
