import { knownValues, type MergePlan } from '@/core/csvImport';
import { accountStatsRepo, postsRepo } from '@/data/repositories';
import type { Post } from '@/data/schemas';
import { BASELINE_STATS } from '@/data/templates';

/** Applies an import plan: new posts in one transaction, known values merged into existing ones. */
export async function applyImport(
  plans: readonly MergePlan<Post>[],
): Promise<{ created: number; updated: number }> {
  const measuredAt = new Date().toISOString();
  const creates = plans.flatMap((plan) =>
    plan.kind === 'create' ? [{ ...plan.draft, measuredAt, source: 'csv' as const }] : [],
  );
  await postsRepo.createMany(creates);
  let updated = 0;
  for (const plan of plans) {
    if (plan.kind !== 'update') continue;
    const current = postsRepo.get(plan.target.id) ?? plan.target;
    await postsRepo.update(current.id, knownValues(plan.draft, current));
    updated += 1;
  }
  return { created: creates.length, updated };
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
