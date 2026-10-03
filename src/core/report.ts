/**
 * Rule-based weekly report (JJJJ-KW): good / bad / why / 3 measures / progress. Without AI the
 * app writes it from these rules; with AI Claude rewrites the draft. Texts are German (they are
 * report content, built from the templates in src/data/templates/report.ts).
 */
import { REPORT_TEXTS as T } from '@/data/templates/report';
import { weekRange } from './dates';
import type { GoalProgress } from './goal';
import {
  bestAndWorst,
  followersPer1000,
  isTooEarly,
  postsBetween,
  totals,
  type PostNumbers,
} from './metrics';

export interface ReportDraft {
  week: string;
  good: string;
  bad: string;
  why: string;
  actions: string[];
  progress: string;
  /** Facts the texts are based on (for the AI prompt and the export). */
  facts: string[];
}

export interface ReportInput {
  week: string;
  posts: readonly PostNumbers[];
  goal: GoalProgress;
  /** Rate of the previous 4 weeks (comparison). */
  baselineRate?: number;
}

const fmt = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });

function label(post: PostNumbers): string {
  return post.topic ? `„${post.topic}“` : T.untitled(post.date);
}

export function buildWeeklyReport({ week, posts, goal, baselineRate }: ReportInput): ReportDraft {
  const { start, end } = weekRange(week);
  const weekPosts = postsBetween(posts, start, end);
  const sum = totals(weekPosts);
  const early = weekPosts.filter(isTooEarly);
  const { best, worst } = bestAndWorst(weekPosts);
  const facts: string[] = [T.period(start, end)];
  const good: string[] = [];
  const bad: string[] = [];
  const why: string[] = [];
  const actions: string[] = [];

  if (weekPosts.length === 0) {
    bad.push(T.noPosts);
    why.push(T.noPostsWhy);
    actions.push(T.actionPublish);
  } else {
    facts.push(T.factTotals(weekPosts.length, fmt(sum.views), fmt(sum.newFollowers)));
    if (sum.rate !== undefined) facts.push(T.factRate(fmt(sum.rate)));
    if (early.length > 0) facts.push(T.factEarly(early.length));

    if (best) {
      const rate = followersPer1000(best.newFollowers, best.views)!;
      good.push(T.best(label(best), fmt(rate), fmt(best.views ?? 0)));
    }
    if (worst) {
      const rate = followersPer1000(worst.newFollowers, worst.views)!;
      bad.push(T.worst(label(worst), fmt(rate), fmt(worst.views ?? 0)));
    }
    if (sum.rate !== undefined && baselineRate !== undefined) {
      if (sum.rate >= baselineRate) good.push(T.rateUp(fmt(sum.rate), fmt(baselineRate)));
      else bad.push(T.rateDown(fmt(sum.rate), fmt(baselineRate)));
    }

    const nonFollower = weekPosts
      .map((post) => post.nonFollowerPct)
      .filter((value): value is number => value !== undefined);
    const avgNonFollower =
      nonFollower.length > 0
        ? nonFollower.reduce((a, b) => a + b, 0) / nonFollower.length
        : undefined;
    if (avgNonFollower !== undefined) {
      facts.push(T.factNonFollower(fmt(avgNonFollower)));
      if (avgNonFollower < 40) {
        bad.push(T.lowReach(fmt(avgNonFollower)));
        why.push(T.lowReachWhy);
        actions.push(T.actionHook);
      } else good.push(T.goodReach(fmt(avgNonFollower)));
    }
    if (sum.rate !== undefined && sum.rate < 5) {
      why.push(T.lowConversionWhy);
      actions.push(T.actionFollowReason);
    }
    const shares = weekPosts.reduce((total, post) => total + (post.shares ?? 0), 0);
    const saves = weekPosts.reduce((total, post) => total + (post.saves ?? 0), 0);
    if (shares + saves > 0) good.push(T.sharesSaves(shares, saves));
    if (best?.hookType || best?.topic) why.push(T.bestWhy(label(best)));
    if (early.length > 0) why.push(T.earlyWhy(early.length));
    if (sum.counted < weekPosts.length) why.push(T.missingValues(weekPosts.length - sum.counted));
  }

  // Always three measures: rule-based ones first, then the growth priorities.
  for (const fallback of T.fallbackActions) {
    if (actions.length >= 3) break;
    if (!actions.includes(fallback)) actions.push(fallback);
  }

  return {
    week,
    good: good.join('\n') || T.nothingGood,
    bad: bad.join('\n') || T.nothingBad,
    why: why.join('\n') || T.noWhy,
    actions: actions.slice(0, 3),
    progress: progressText(goal),
    facts,
  };
}

export function progressText(goal: GoalProgress): string {
  if (goal.current === undefined) return T.progressUnknown;
  const base = T.progressBase(goal.current, goal.target, goal.asOf ?? '');
  switch (goal.status) {
    case 'reached':
      return `${base} ${T.progressReached}`;
    case 'onTrack':
      return `${base} ${T.progressOnTrack(fmt(goal.pacePerWeek!), fmt(goal.neededPerWeek!))}`;
    case 'behind':
      return `${base} ${
        goal.pacePerWeek === undefined
          ? T.progressBehindNoPace(fmt(goal.neededPerWeek ?? goal.remaining ?? 0))
          : T.progressBehind(
              fmt(goal.pacePerWeek),
              fmt(goal.neededPerWeek!),
              goal.projected ?? goal.current,
            )
      }`;
    default:
      return `${base} ${T.progressNoPace(fmt(goal.neededPerWeek ?? 0))}`;
  }
}

export function reportToMarkdown(
  report: {
    week: string;
    good?: string;
    bad?: string;
    why?: string;
    actions: readonly string[];
    progress?: string;
  },
  facts: readonly string[] = [],
): string {
  const section = (title: string, body?: string) => `## ${title}\n\n${body?.trim() || '–'}\n`;
  return [
    `# ${T.mdTitle(report.week)}\n`,
    facts.length ? `${facts.map((fact) => `- ${fact}`).join('\n')}\n` : '',
    section(T.mdGood, report.good),
    section(T.mdBad, report.bad),
    section(T.mdWhy, report.why),
    `## ${T.mdActions}\n\n${report.actions.map((action, index) => `${index + 1}. ${action}`).join('\n') || '–'}\n`,
    section(T.mdProgress, report.progress),
  ]
    .filter(Boolean)
    .join('\n');
}
