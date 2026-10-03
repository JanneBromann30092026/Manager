import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Plus } from 'lucide-react';
import { Badge, Button, ProgressBar, Surface, cn } from '@/components/ui';
import { Page } from '@/app/shell/Page';
import { nextCta } from '@/core/cta';
import { isoWeekOf, localDateOf, weekRange } from '@/core/dates';
import { postsInLastDays, totals } from '@/core/metrics';
import { formatMinutes, sortPlanItems, summarizePlan } from '@/core/plan';
import { selectBrand } from '@/data/repositories';
import type { Post } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { CTA_TEMPLATES, GOAL_DEFAULTS, VIDEO_STATUS_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { InstagramTokenReminder } from '@/features/connections/InstagramSettings';
import { BackupReminder } from '@/features/settings/BackupSettings';
import { dayLabel, usePlan } from '@/features/plan/planData';
import { PostRow } from '@/features/stats/PostsTab';
import { formatDay, formatNumber, useGoal, usePosts } from '@/features/stats/statsData';
import { VIDEO_STATUS_TONES } from '@/features/videos/videoFormat';

const t = de.start;

const STATUS_TONES = {
  reached: 'success',
  onTrack: 'success',
  behind: 'warning',
  unknown: 'accent',
} as const;

function GoalCard() {
  const goal = useGoal();
  return (
    <Surface padding="md" className="flex flex-col gap-4 wide:col-span-2" data-testid="goal-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-fg-secondary">{t.goal}</span>
          <h2 className="text-xl font-semibold text-fg">
            {t.goalTitle(goal.target, formatDay(GOAL_DEFAULTS.deadline))}
          </h2>
        </div>
        {goal.asOf && <span className="text-sm text-fg-muted">{t.asOf(formatDay(goal.asOf))}</span>}
      </div>
      {goal.current === undefined ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-base text-fg-secondary">{t.noFollowers}</p>
          <Link
            to="/stats"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-accent-fg"
          >
            {t.toStats}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <span
              className="text-4xl font-semibold tracking-tight text-fg tabular-nums"
              data-testid="goal-current"
            >
              {t.followers(goal.current)}
            </span>
            <span className="text-sm text-fg-secondary">
              {t.remaining(goal.remaining ?? 0)} · {t.weeksLeft(formatNumber(goal.weeksLeft))}
            </span>
          </div>
          <ProgressBar
            value={goal.fraction}
            label={t.goalTitle(goal.target, formatDay(GOAL_DEFAULTS.deadline))}
            tone={goal.status === 'behind' ? 'warning' : 'success'}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-xl bg-surface-sunken p-3">
              <span className="text-sm text-fg-secondary">{t.needed}</span>
              <span
                className="text-2xl font-semibold text-fg tabular-nums"
                data-testid="goal-needed"
              >
                {formatNumber(goal.neededPerWeek)}
              </span>
            </div>
            <div className="flex flex-col rounded-xl bg-surface-sunken p-3">
              <span className="text-sm text-fg-secondary">{t.pace}</span>
              <span className="text-2xl font-semibold text-fg tabular-nums" data-testid="goal-pace">
                {formatNumber(goal.pacePerWeek)}
              </span>
              {goal.paceSource && (
                <span className="text-sm text-fg-muted">{t.paceSource[goal.paceSource]}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Badge tone={STATUS_TONES[goal.status]}>
              <span data-testid="goal-status">{t.status[goal.status]}</span>
            </Badge>
            {goal.projected !== undefined && goal.status !== 'reached' && (
              <span className="px-1 text-sm text-fg-secondary">{t.projected(goal.projected)}</span>
            )}
          </div>
        </>
      )}
    </Surface>
  );
}

function MetricCard({ posts }: { posts: readonly Post[] }) {
  const today = localDateOf();
  const range = weekRange(isoWeekOf(today));
  const week = totals(posts.filter((post) => post.date >= range.start && post.date <= range.end));
  const days30 = totals(postsInLastDays(posts, today, 30));
  const cell = (title: string, sum: ReturnType<typeof totals>, testId: string) => (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-sunken p-3">
      <span className="text-sm text-fg-secondary">{title}</span>
      <span className="text-3xl font-semibold text-fg tabular-nums" data-testid={testId}>
        {formatNumber(sum.rate)}
      </span>
      <span className="text-sm text-fg-muted">
        {t.metricBase(formatNumber(sum.views), formatNumber(sum.newFollowers))}
      </span>
    </div>
  );
  return (
    <Surface padding="md" className="flex flex-col gap-3" data-testid="metric-start">
      <h2 className="text-base font-semibold text-fg">{t.metric}</h2>
      <div className="grid grid-cols-2 gap-3">
        {cell(t.week, week, 'metric-week')}
        {cell(t.days30, days30, 'metric-30')}
      </div>
      {days30.counted === 0 && <p className="text-sm text-fg-muted">{t.noMetric}</p>}
    </Surface>
  );
}

function ThisWeek() {
  const videosMap = useDataStore((s) => s.videos);
  const brand = useDataStore(selectBrand);
  const week = isoWeekOf(localDateOf());
  const plan = usePlan(week);
  const range = weekRange(week);
  const videos = useMemo(
    () =>
      Object.values(videosMap)
        .filter((video) => video.date >= range.start && video.date <= range.end)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [videosMap, range.start, range.end],
  );
  const items = plan ? sortPlanItems(plan.items) : [];
  const summary = plan ? summarizePlan(plan.items, plan.budgetMinutes) : undefined;
  return (
    <Surface padding="md" className="flex flex-col gap-3" data-testid="this-week">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{t.thisWeek}</h2>
        <Badge tone="signal">
          <span data-testid="start-next-cta">
            {t.nextCta}: {CTA_TEMPLATES[nextCta(brand.lastCta)].label}
          </span>
        </Badge>
      </div>
      {items.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y divide-line" data-testid="start-plan">
            {items.map((item) => (
              <li key={item.id} className="flex min-h-12 items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-fg-secondary">{dayLabel(item.date)}</span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-medium text-fg',
                    item.done && 'text-fg-muted line-through',
                  )}
                >
                  {item.title}
                </span>
                {item.done ? (
                  <Badge tone="success">{de.plan.done}</Badge>
                ) : (
                  <span className="shrink-0 text-fg-muted tabular-nums">
                    {de.plan.minutes(item.minutes)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {summary && (
            <span className="text-sm text-fg-secondary">
              {de.plan.progress(summary.done, summary.total)} ·{' '}
              {de.plan.budgetUsed(formatMinutes(summary.used), formatMinutes(plan!.budgetMinutes))}
            </span>
          )}
        </>
      ) : videos.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.thisWeekEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {videos.map((video) => (
            <li key={video.id}>
              <Link
                to={`/videos/${video.id}`}
                className="flex min-h-12 items-center gap-3 py-2 text-sm"
              >
                <span className="w-24 shrink-0 text-fg-secondary">{formatDay(video.date)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{video.topic}</span>
                <Badge tone={VIDEO_STATUS_TONES[video.status]}>
                  {VIDEO_STATUS_LABELS[video.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          to={`/plan?week=${week}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-fg"
        >
          {t.toPlan}
          <ArrowRight size={14} aria-hidden />
        </Link>
        <Link
          to="/videos"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-fg"
        >
          {t.toVideos}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </Surface>
  );
}

/** Dashboard: goal progress, main metric, this week, next CTA, recent posts. */
export function StartPage() {
  const navigate = useNavigate();
  const posts = usePosts();
  return (
    <Page
      title={t.title}
      actions={
        <Button
          size="sm"
          icon={Plus}
          onClick={() => void navigate('/stats?new=1')}
          data-testid="start-add-post"
        >
          <span className="max-[30rem]:sr-only">{t.addPost}</span>
        </Button>
      }
    >
      <div className="grid gap-4 pb-8 wide:grid-cols-2">
        <InstagramTokenReminder />
        <BackupReminder />
        <GoalCard />
        <MetricCard posts={posts} />
        <ThisWeek />
        <section className="flex flex-col gap-2 wide:col-span-2" data-testid="recent-posts">
          <h2 className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
            {t.recent}
          </h2>
          {posts.length === 0 ? (
            <p className="px-2 text-sm text-fg-muted">{t.recentEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {posts.slice(0, 5).map((post) => (
                <PostRow key={post.id} post={post} onOpen={() => void navigate('/stats')} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
