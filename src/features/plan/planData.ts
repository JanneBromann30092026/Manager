import { useMemo } from 'react';
import { plannedElsewhere, sortPlanItems, suggestPlan } from '@/core/plan';
import { isoWeekOf, localDateOf } from '@/core/dates';
import { ideasRepo, plansRepo } from '@/data/repositories';
import type { Plan, PlanItem } from '@/data/schemas';
import { dataStore, useDataStore } from '@/data/store';
import { PLAN_REELS_TARGET } from '@/data/templates';
import { useSettings } from '@/features/settings/settingsStore';

export function findPlan(plans: Record<string, Plan>, week: string): Plan | undefined {
  return Object.values(plans).find((plan) => plan.week === week);
}

export function usePlan(week: string): Plan | undefined {
  const plans = useDataStore((s) => s.plans);
  return useMemo(() => findPlan(plans, week), [plans, week]);
}

/** Saves the items of a week's plan (creates the plan on first save). */
export async function savePlanItems(week: string, items: readonly PlanItem[]): Promise<Plan> {
  const sorted = sortPlanItems(items);
  const existing = findPlan(useDataStore.getState().plans, week);
  if (existing) return plansRepo.update(existing.id, { items: sorted });
  return plansRepo.create({
    week,
    budgetMinutes: useSettings.getState().planBudget,
    items: sorted,
  });
}

export async function setPlanBudget(week: string, budgetMinutes: number): Promise<void> {
  const existing = findPlan(useDataStore.getState().plans, week);
  if (existing) await plansRepo.update(existing.id, { budgetMinutes });
}

/** Ideas in a plan move from „Idee“ to „geplant“. */
export async function markIdeasPlanned(items: readonly PlanItem[]): Promise<void> {
  for (const item of items) {
    if (!item.ideaId) continue;
    const idea = dataStore.get('ideas', item.ideaId);
    if (idea?.status === 'idea') await ideasRepo.update(idea.id, { status: 'planned' });
  }
}

/** Ideas/videos planned in other weeks from this week on. */
export function excludedIds(week: string): Set<string> {
  const plans = Object.values(useDataStore.getState().plans);
  return plannedElsewhere(plans, week, isoWeekOf(localDateOf()));
}

/** Creates (or replaces) the plan of a week with a suggestion. Returns the skipped count. */
export async function createSuggestion(week: string): Promise<number> {
  const state = useDataStore.getState();
  const settings = useSettings.getState();
  const existing = findPlan(state.plans, week);
  const suggestion = suggestPlan({
    week,
    ideas: Object.values(state.ideas),
    videos: Object.values(state.videos),
    budgetMinutes: existing?.budgetMinutes ?? settings.planBudget,
    durations: settings.planDurations,
    reelsTarget: PLAN_REELS_TARGET,
    excludeIds: excludedIds(week),
    newId: () => crypto.randomUUID(),
  });
  await savePlanItems(week, suggestion.items);
  await markIdeasPlanned(suggestion.items);
  return suggestion.skipped;
}

/** "Mo., 05.10." */
export function dayLabel(date: string, weekday: 'short' | 'long' = 'short'): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', {
    weekday,
    day: '2-digit',
    month: '2-digit',
  });
}

/** Whole minutes in 0..max from German input ("90"); undefined if invalid. */
export function parseMinutes(text: string, min = 0, max = 720): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : undefined;
}
