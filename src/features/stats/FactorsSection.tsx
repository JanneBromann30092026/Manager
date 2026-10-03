import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge, Button, Surface } from '@/components/ui';
import { factorsPrompt } from '@/core/ai/factors';
import { analyzeFactors, type FactorAnalysis, type FactorKey } from '@/core/factors';
import type { Post } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { HOOK_TEMPLATES } from '@/data/templates';
import { de } from '@/i18n/de';
import { AiError, generate } from '@/services/ai/client';
import { useSettings } from '@/features/settings/settingsStore';
import { formatNumber } from './statsData';

const t = de.stats.factors;

function groupLabel(factor: FactorKey, key: string): string {
  switch (factor) {
    case 'weekday':
      return t.weekdays[Number(key) - 1] ?? key;
    case 'hookType':
      return HOOK_TEMPLATES[key as keyof typeof HOOK_TEMPLATES]?.label ?? key;
    case 'series':
      return key;
    default:
      return (t.groups[factor] as Record<string, string>)[key] ?? key;
  }
}

function ratioText(ratio: number): string {
  const percent = Math.round(Math.abs(ratio - 1) * 100);
  return ratio >= 1 ? t.more(percent) : t.less(percent);
}

function findingText(analysis: FactorAnalysis, index: number): string {
  const finding = analysis.findings[index]!;
  return t.finding(
    `${t.factors[finding.factor]} ${groupLabel(finding.factor, finding.key)}`,
    ratioText(finding.ratio),
    finding.posts,
  );
}

/** Facts for Claude: basis, findings and every group (numbers only). */
function factsOf(analysis: FactorAnalysis): string[] {
  return [
    t.basis(analysis.reels, formatNumber(analysis.medianViews), analysis.atSevenDays),
    ...analysis.findings.map(
      (finding, index) =>
        `${findingText(analysis, index)}${finding.uncertain ? ` [${t.uncertain}]` : ''}`,
    ),
    ...analysis.factors.flatMap(({ factor, groups }) =>
      groups.map(
        (group) =>
          `${t.factors[factor]} ${groupLabel(factor, group.key)}: ${group.posts} Reels, Median ${formatNumber(group.medianViews)} Aufrufe${group.interactionsPer1000 === undefined ? '' : `, ${formatNumber(group.interactionsPer1000)} Interaktionen pro 1.000 Aufrufe`}`,
      ),
    ),
  ];
}

/** „Was funktioniert“: which reel properties go along with more or fewer views. */
export function FactorsSection({ posts }: { posts: readonly Post[] }) {
  const videos = useDataStore((s) => s.videos);
  const aiEnabled = useSettings((s) => s.aiEnabled);
  const model = useSettings((s) => s.aiModel);
  const [now] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(
    () =>
      analyzeFactors(posts, {
        now,
        seriesOf: (post) => (post.videoId ? videos[post.videoId]?.series : undefined),
      }),
    [posts, videos, now],
  );

  const explain = async () => {
    setBusy(true);
    setError(null);
    try {
      const answer = await generate({
        model,
        prompt: factorsPrompt(factsOf(analysis)),
        maxTokens: 1_200,
      });
      setExplanation(answer.trim());
    } catch (caught: unknown) {
      setError(de.settings.ai.errors[caught instanceof AiError ? caught.reason : 'unknown']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface padding="sm" className="flex flex-col gap-3" data-testid="factors">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-base font-semibold text-fg">{t.title}</h2>
        <p className="text-sm text-fg-muted">{t.intro}</p>
      </div>
      {!analysis.enough ? (
        <p className="px-1 text-sm text-fg-secondary" data-testid="factors-not-enough">
          {t.notEnough(analysis.reels)}
        </p>
      ) : (
        <>
          <p className="px-1 text-sm text-fg-secondary" data-testid="factors-basis">
            {t.basis(analysis.reels, formatNumber(analysis.medianViews), analysis.atSevenDays)}
          </p>
          <div className="flex flex-col gap-2 px-1">
            <h3 className="text-sm font-semibold text-fg">{t.findings}</h3>
            {analysis.findings.length === 0 ? (
              <p className="text-sm text-fg-secondary">{t.noFindings}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="factors-findings">
                {analysis.findings.map((finding, index) => (
                  <li
                    key={`${finding.factor}-${finding.key}`}
                    className="flex items-start gap-2 text-sm text-fg"
                  >
                    <span
                      aria-hidden
                      className={finding.ratio >= 1 ? 'text-success' : 'text-danger'}
                    >
                      {finding.ratio >= 1 ? '▲' : '▼'}
                    </span>
                    <span className="min-w-0">
                      {findingText(analysis, index)}
                      {finding.uncertain && (
                        <Badge tone="warning" className="ml-2 align-middle">
                          {t.uncertain}
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {analysis.findings.some((finding) => finding.uncertain) && (
              <p className="text-sm text-fg-muted">{t.uncertainHint}</p>
            )}
          </div>
          <details className="rounded-xl bg-surface-sunken px-3 py-2">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-fg">
              {t.details}
            </summary>
            <div className="flex flex-col gap-4 py-2">
              {analysis.factors.map(({ factor, groups }) => (
                <div key={factor} className="overflow-x-auto" data-testid={`factor-${factor}`}>
                  <table className="w-full text-left text-sm">
                    <caption className="pb-1 text-left font-semibold text-fg">
                      {t.factors[factor]}
                    </caption>
                    <thead className="text-fg-secondary">
                      <tr>
                        <th className="py-1.5 pr-2 font-medium">{t.group}</th>
                        <th className="px-2 py-1.5 text-right font-medium">{t.reels}</th>
                        <th className="px-2 py-1.5 text-right font-medium">{t.medianViews}</th>
                        <th className="px-2 py-1.5 text-right font-medium">{t.ratio}</th>
                        <th className="hidden py-1.5 pl-2 text-right font-medium sm:table-cell">
                          {t.interactions}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-fg tabular-nums">
                      {groups.map((group) => (
                        <tr key={group.key}>
                          <td className="py-2 pr-2">{groupLabel(factor, group.key)}</td>
                          <td className="px-2 py-2 text-right">{group.posts}</td>
                          <td className="px-2 py-2 text-right">
                            {formatNumber(group.medianViews)}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold">
                            {formatNumber(Math.round(group.ratio * 100) / 100)}×
                          </td>
                          <td className="hidden py-2 pl-2 text-right sm:table-cell">
                            {formatNumber(group.interactionsPer1000)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </details>
          {aiEnabled && (
            <div className="flex flex-col gap-2 px-1">
              <Button
                size="sm"
                variant="secondary"
                icon={Sparkles}
                className="self-start"
                loading={busy}
                onClick={() => void explain()}
                data-testid="factors-explain"
              >
                {busy ? t.explaining : t.explain}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              {explanation && (
                <div
                  className="rounded-xl bg-signal-soft px-4 py-3 text-sm text-fg"
                  data-testid="factors-explanation"
                >
                  <p className="pb-1 font-semibold">{t.explanation}</p>
                  <p className="whitespace-pre-line">{explanation}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {analysis.tooYoung > 0 && (
        <p className="px-1 text-sm text-fg-muted">{t.tooYoung(analysis.tooYoung)}</p>
      )}
    </Surface>
  );
}
