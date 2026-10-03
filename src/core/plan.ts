/**
 * Weekly plan: Reels, Stories and Q&A within the time budget (default 4 hours). Topics come
 * from started videos first (finish what is begun), then from open ideas by growth priority
 * (community questions first). The Q&A story is always in the plan (growth priority 4).
 */
import type { PlanItemKind, VideoStatus } from '@/data/domain';
import type { Idea, PlanItem, Video } from '@/data/schemas';
import { PLAN_SLOTS, PLAN_TEXTS, VIDEO_REMAINING_SHARE } from '@/data/templates/plan';
import { addDays, weekRange } from './dates';
import { sortIdeas } from './ideas';

export type PlanDurations = Record<PlanItemKind, number>;

/** The seven dates (Monday … Sunday) of an ISO week. */
export function weekDays(week: string): string[] {
  const { start } = weekRange(week);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Weekday 1 (Monday) … 7 (Sunday) → date in the week. */
export function dayOfWeek(week: string, weekday: number): string {
  return addDays(weekRange(week).start, weekday - 1);
}

const TITLE_MAX = 160;
const clip = (text: string) =>
  text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;

const STATUS_RANK: Record<VideoStatus, number> = {
  edited: 0,
  filmed: 1,
  script: 2,
  idea: 3,
  published: 4,
};

export interface SuggestInput {
  week: string;
  ideas: readonly Idea[];
  videos: readonly Video[];
  budgetMinutes: number;
  durations: PlanDurations;
  reelsTarget: number;
  /** Ideas/videos already planned in another week. */
  excludeIds?: ReadonlySet<string>;
  newId: () => string;
}

export interface Suggestion {
  items: PlanItem[];
  /** Topics that would have fit the reel slots but not the budget. */
  skipped: number;
}

interface Candidate {
  kind: 'reel' | 'podcast';
  title: string;
  minutes: number;
  ideaId?: string;
  videoId?: string;
}

/** Started videos first (most advanced first), then open ideas by priority. */
export function reelCandidates(
  input: Pick<SuggestInput, 'ideas' | 'videos' | 'durations' | 'excludeIds'>,
): Candidate[] {
  const exclude = input.excludeIds ?? new Set<string>();
  const videos = input.videos
    .filter((video) => video.status !== 'published' && !exclude.has(video.id))
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .map((video): Candidate => {
      const kind = video.kind === 'podcast' ? 'podcast' : 'reel';
      return {
        kind,
        title: clip(PLAN_TEXTS.videoTask(video.status, video.topic)),
        minutes: Math.round(input.durations[kind] * VIDEO_REMAINING_SHARE[video.status]),
        videoId: video.id,
        ideaId: video.ideaId,
      };
    });
  const withVideo = new Set(input.videos.map((video) => video.ideaId).filter(Boolean));
  const ideas = sortIdeas(
    input.ideas.filter(
      (idea) =>
        (idea.status === 'idea' || idea.status === 'planned') &&
        !idea.videoId &&
        !withVideo.has(idea.id) &&
        !exclude.has(idea.id),
    ),
  ).map((idea): Candidate => ({
    kind: 'reel',
    title: clip(PLAN_TEXTS.ideaTask(idea.title)),
    minutes: input.durations.reel,
    ideaId: idea.id,
  }));
  return [...videos, ...ideas];
}

/** Suggests a plan: Q&A story, up to `reelsTarget` reels that fit, then stories. */
export function suggestPlan(input: SuggestInput): Suggestion {
  const items: PlanItem[] = [];
  const add = (item: Omit<PlanItem, 'id' | 'done'>) =>
    items.push({ ...item, id: input.newId(), done: false });
  let used = 0;

  // Q&A story at least once a week – always, even if the budget is tight.
  add({
    date: dayOfWeek(input.week, PLAN_SLOTS.qa),
    kind: 'qa',
    title: PLAN_TEXTS.qaTitle,
    minutes: input.durations.qa,
  });
  used += input.durations.qa;

  let reels = 0;
  let skipped = 0;
  for (const candidate of reelCandidates(input)) {
    if (reels >= input.reelsTarget) break;
    if (used + candidate.minutes > input.budgetMinutes) {
      skipped += 1;
      continue;
    }
    const weekday = PLAN_SLOTS.reels[reels] ?? PLAN_SLOTS.reels[PLAN_SLOTS.reels.length - 1]!;
    add({
      date: dayOfWeek(input.week, weekday),
      kind: candidate.kind,
      title: candidate.title,
      minutes: candidate.minutes,
      ideaId: candidate.ideaId,
      videoId: candidate.videoId,
    });
    used += candidate.minutes;
    reels += 1;
  }

  for (const story of PLAN_SLOTS.stories) {
    if (used + input.durations.story > input.budgetMinutes) break;
    add({
      date: dayOfWeek(input.week, story.day),
      kind: 'story',
      title: story.title,
      minutes: input.durations.story,
    });
    used += input.durations.story;
  }

  return { items: sortPlanItems(items), skipped };
}

const KIND_ORDER: Record<PlanItemKind, number> = { reel: 0, podcast: 1, qa: 2, story: 3, other: 4 };

export function sortPlanItems<T extends Pick<PlanItem, 'date' | 'kind'>>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

export type PlanWarning = 'noQa' | 'noReel' | 'overBudget';

export interface PlanSummary {
  used: number;
  remaining: number;
  /** 0..1 of the budget (can exceed 1 when over budget). */
  fraction: number;
  done: number;
  total: number;
  warnings: PlanWarning[];
}

export function summarizePlan(items: readonly PlanItem[], budgetMinutes: number): PlanSummary {
  const used = items.reduce((sum, item) => sum + item.minutes, 0);
  const warnings: PlanWarning[] = [];
  if (!items.some((item) => item.kind === 'qa')) warnings.push('noQa');
  if (!items.some((item) => item.kind === 'reel' || item.kind === 'podcast'))
    warnings.push('noReel');
  if (used > budgetMinutes) warnings.push('overBudget');
  return {
    used,
    remaining: budgetMinutes - used,
    fraction: budgetMinutes > 0 ? used / budgetMinutes : used > 0 ? 1 : 0,
    done: items.filter((item) => item.done).length,
    total: items.length,
    warnings,
  };
}

/** "3 Std. 20 Min." – minutes as hours and minutes. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const value = Math.abs(Math.round(minutes));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${sign}${rest} Min.`;
  if (rest === 0) return `${sign}${hours} Std.`;
  return `${sign}${hours} Std. ${rest} Min.`;
}

/** Calendar events for the open tasks of a plan. */
export function planEvents(
  items: readonly PlanItem[],
  labels: Record<PlanItemKind, string>,
  describe: (kind: string, minutes: number) => string,
): { uid: string; date: string; summary: string; description: string }[] {
  return sortPlanItems(items.filter((item) => !item.done)).map((item) => ({
    uid: item.id,
    date: item.date,
    summary: item.title,
    description: describe(labels[item.kind], item.minutes),
  }));
}

/**
 * Ids of ideas and videos already planned in another week from `fromWeek` on (older plans do
 * not block: what was not done there may be planned again).
 */
export function plannedElsewhere(
  plans: readonly { week: string; items: readonly PlanItem[] }[],
  week: string,
  fromWeek: string,
): Set<string> {
  const ids = new Set<string>();
  for (const plan of plans) {
    if (plan.week === week || plan.week < fromWeek) continue;
    for (const item of plan.items) {
      if (item.ideaId) ids.add(item.ideaId);
      if (item.videoId) ids.add(item.videoId);
    }
  }
  return ids;
}
