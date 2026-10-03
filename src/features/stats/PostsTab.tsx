import { ChevronRight, Users } from 'lucide-react';
import { Badge, Button, Surface, toast } from '@/components/ui';
import { isoWeekOf, localDateOf, weekRange } from '@/core/dates';
import { followersPer1000, isTooEarly, postsInLastDays, totals } from '@/core/metrics';
import type { Post } from '@/data/schemas';
import { FORMAT_LABELS, PLATFORM_LABELS, VALUE_SOURCE_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { hasBaseline, importBaseline } from './statsActions';
import { formatDay, formatNumber, useAccountStats } from './statsData';

const t = de.stats;

function MetricCard({ title, posts }: { title: string; posts: readonly Post[] }) {
  const sum = totals(posts);
  return (
    <Surface padding="sm" className="flex flex-col gap-1" data-testid="metric-card">
      <span className="text-sm font-medium text-fg-secondary">{title}</span>
      <span className="text-3xl font-semibold tracking-tight text-fg tabular-nums">
        {formatNumber(sum.rate)}
      </span>
      <span className="text-sm text-fg-muted">{t.rateLong}</span>
      <span className="text-sm text-fg-secondary">
        {de.start.metricBase(formatNumber(sum.views), formatNumber(sum.newFollowers))}
      </span>
    </Surface>
  );
}

function FollowersCard({ onAdd }: { onAdd: () => void }) {
  const stats = useAccountStats();
  const latest = stats[0];
  return (
    <Surface padding="sm" className="flex flex-col gap-2" data-testid="followers-card">
      <span className="text-sm font-medium text-fg-secondary">{t.followersCard}</span>
      {latest ? (
        <>
          <span className="text-3xl font-semibold tracking-tight text-fg tabular-nums">
            {formatNumber(latest.followers)}
          </span>
          <span className="text-sm text-fg-muted">
            {PLATFORM_LABELS[latest.platform]} · {de.start.asOf(formatDay(latest.date))}
          </span>
        </>
      ) : (
        <span className="text-sm text-fg-muted">{t.followersNone}</span>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="secondary" icon={Users} onClick={onAdd}>
          {t.addFollowers}
        </Button>
        {!hasBaseline(stats) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void importBaseline().then(() => toast.success(t.baselineDone))}
            data-testid="baseline-import"
          >
            {t.baseline}
          </Button>
        )}
      </div>
    </Surface>
  );
}

export function PostRow({ post, onOpen }: { post: Post; onOpen: (post: Post) => void }) {
  const rate = followersPer1000(post.newFollowers, post.views);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(post)}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-card transition-colors hover:bg-surface-raised"
        data-testid="post-card"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-base font-medium text-fg">
            {post.topic ?? FORMAT_LABELS[post.format]}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
            <span>{formatDay(post.date)}</span>
            <Badge>{PLATFORM_LABELS[post.platform]}</Badge>
            <Badge>{FORMAT_LABELS[post.format]}</Badge>
            {post.source === 'screenshot' && (
              <Badge tone="signal">{VALUE_SOURCE_LABELS.screenshot}</Badge>
            )}
            {isTooEarly(post) && (
              <Badge tone="warning">
                <span title={t.earlyHint}>{t.early}</span>
              </Badge>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right tabular-nums">
          <span className="text-base font-semibold text-fg" data-testid="post-rate">
            {formatNumber(rate)} <span className="text-sm font-normal text-fg-muted">{t.rate}</span>
          </span>
          <span className="text-sm text-fg-muted">
            {formatNumber(post.views)} {t.views} · +{formatNumber(post.newFollowers)}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-fg-muted" aria-hidden />
      </button>
    </li>
  );
}

/** Posts by week (newest first) with the main metric for this week and the last 30 days. */
export function PostsTab({
  posts,
  onOpen,
  onAddFollowers,
}: {
  posts: readonly Post[];
  onOpen: (post: Post) => void;
  onAddFollowers: () => void;
}) {
  const today = localDateOf();
  const thisWeek = weekRange(isoWeekOf(today));
  const groups = (() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      const week = isoWeekOf(post.date);
      map.set(week, [...(map.get(week) ?? []), post]);
    }
    return [...map.entries()];
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title={t.summaryWeek}
          posts={posts.filter((post) => post.date >= thisWeek.start && post.date <= thisWeek.end)}
        />
        <MetricCard title={t.summary30} posts={postsInLastDays(posts, today, 30)} />
        <FollowersCard onAdd={onAddFollowers} />
      </div>
      {groups.map(([week, items]) => {
        const range = weekRange(week);
        return (
          <section key={week} className="flex flex-col gap-2">
            <h2 className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
              {t.weekLabel(week, formatDay(range.start), formatDay(range.end))}
            </h2>
            <ul className="flex flex-col gap-3">
              {items.map((post) => (
                <PostRow key={post.id} post={post} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
