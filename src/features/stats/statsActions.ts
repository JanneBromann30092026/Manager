import { knownValues, type MergePlan } from '@/core/csvImport';
import { accountStatsRepo, postsRepo } from '@/data/repositories';
import type { ValueSource } from '@/data/domain';
import type { Post } from '@/data/schemas';
import { BASELINE_STATS } from '@/data/templates';

/**
 * Applies an import plan: new posts in one transaction, known values merged into existing ones.
 * API imports (fresh numbers) also update source and „Stand“ of existing posts.
 */
export async function applyImport(
  plans: readonly MergePlan<Post>[],
  source: Extract<ValueSource, 'csv' | 'youtubeApi'> = 'csv',
): Promise<{ created: number; updated: number }> {
  const measuredAt = new Date().toISOString();
  const creates = plans.flatMap((plan) =>
    plan.kind === 'create' ? [{ ...plan.draft, measuredAt, source }] : [],
  );
  await postsRepo.createMany(creates);
  let updated = 0;
  for (const plan of plans) {
    if (plan.kind !== 'update') continue;
    const current = postsRepo.get(plan.target.id) ?? plan.target;
    await postsRepo.update(current.id, {
      ...knownValues(plan.draft, current),
      ...(source === 'csv' ? {} : { source, measuredAt }),
    });
    updated += 1;
  }
  return { created: creates.length, updated };
}

/** Today's follower count of a platform from an API (one entry per day and platform). */
export async function saveFollowerCount(
  platform: 'youtube' | 'instagram',
  followers: number,
  source: Extract<ValueSource, 'youtubeApi' | 'instagramApi'>,
  date: string,
): Promise<void> {
  const existing = accountStatsRepo
    .list()
    .find((stat) => stat.date === date && stat.platform === platform);
  if (existing) await accountStatsRepo.update(existing.id, { followers, source });
  else await accountStatsRepo.create({ date, platform, followers, source });
}

export function hasBaseline(stats: readonly { date: string; platform: string }[]): boolean {
  return stats.some(
    (stat) => stat.date === BASELINE_STATS.date && stat.platform === BASELINE_STATS.platform,
  );
}

/** First follower count from the start values of 28.09.2026. */
export async function importBaseline(): Promise<void> {
  await accountStatsRepo.create({ ...BASELINE_STATS });
}
