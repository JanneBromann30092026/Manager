import { useMemo } from 'react';
import { Surface } from '@/components/ui';
import { groupStats, type GroupStats } from '@/core/metrics';
import type { Post } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { FORMAT_LABELS, HOOK_TEMPLATES } from '@/data/templates';
import { de } from '@/i18n/de';
import { formatNumber } from './statsData';

const t = de.stats.insights;

function Table({
  title,
  rows,
  label,
}: {
  title: string;
  rows: GroupStats[];
  label: (key: string) => string;
}) {
  return (
    <Surface padding="sm" className="flex flex-col gap-2" data-testid="insights-table">
      <h2 className="px-1 text-base font-semibold text-fg">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-1 text-sm text-fg-muted">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="text-fg-secondary">
              <tr>
                <th className="py-2 pr-2 pl-1 font-medium">{title}</th>
                <th className="px-2 py-2 text-right font-medium">{t.posts}</th>
                <th className="px-2 py-2 text-right font-medium">{t.avgViews}</th>
                <th className="px-2 py-2 text-right font-medium">{t.avgNonFollower}</th>
                <th className="py-2 pr-1 pl-2 text-right font-medium">{de.stats.rate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-fg tabular-nums">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="max-w-[16rem] truncate py-2.5 pr-2 pl-1 font-medium">
                    {label(row.key)}
                  </td>
                  <td className="px-2 py-2.5 text-right">{row.posts}</td>
                  <td className="px-2 py-2.5 text-right">{formatNumber(row.avgViews)}</td>
                  <td className="px-2 py-2.5 text-right">
                    {row.avgNonFollowerPct === undefined
                      ? '–'
                      : `${formatNumber(row.avgNonFollowerPct)} %`}
                  </td>
                  <td className="py-2.5 pr-1 pl-2 text-right font-semibold">
                    {formatNumber(row.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Surface>
  );
}

/** „Was funktioniert“: averages by hook type, format, series and the best topics. */
export function InsightsTab({ posts }: { posts: readonly Post[] }) {
  const videos = useDataStore((s) => s.videos);
  const groups = useMemo(
    () => ({
      hook: groupStats(posts, (post) => post.hookType),
      format: groupStats(posts, (post) => post.format),
      series: groupStats(posts, (post) =>
        post.videoId ? videos[post.videoId]?.series : undefined,
      ),
      topics: groupStats(posts, (post) => post.topic).slice(0, 5),
    }),
    [posts, videos],
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm text-fg-muted">
        {t.intro} {t.few}
      </p>
      <Table
        title={t.hook}
        rows={groups.hook}
        label={(key) => HOOK_TEMPLATES[key as keyof typeof HOOK_TEMPLATES].label}
      />
      <Table
        title={t.format}
        rows={groups.format}
        label={(key) => FORMAT_LABELS[key as keyof typeof FORMAT_LABELS]}
      />
      <Table title={t.series} rows={groups.series} label={(key) => key} />
      <Table title={t.topics} rows={groups.topics} label={(key) => key} />
    </div>
  );
}
