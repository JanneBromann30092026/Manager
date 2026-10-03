import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Badge, Button, IconButton, Input, Surface, Textarea, toast } from '@/components/ui';
import { parseReportAnswer, reportPrompt } from '@/core/ai/report';
import { addDays, isoWeekOf, localDateOf, shiftWeek, weekRange } from '@/core/dates';
import { postsBetween, totals } from '@/core/metrics';
import { buildWeeklyReport, reportToMarkdown, type ReportDraft } from '@/core/report';
import { reportsRepo } from '@/data/repositories';
import type { Post, Report } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { REPORT_OUTLINE } from '@/data/templates';
import { de } from '@/i18n/de';
import { AiError, generate } from '@/services/ai/client';
import { copyText, saveFile } from '@/services/share';
import { useSettings } from '@/features/settings/settingsStore';
import { formatDay, useGoal } from './statsData';

const t = de.stats.report;
const labels = Object.fromEntries(REPORT_OUTLINE.map((item) => [item.key, item.label])) as Record<
  (typeof REPORT_OUTLINE)[number]['key'],
  string
>;

interface Texts {
  good: string;
  bad: string;
  why: string;
  actions: string[];
  progress: string;
  fromAi: boolean;
}

function fromDraft(draft: ReportDraft): Texts {
  return { ...draft, actions: [...draft.actions], fromAi: false };
}

function fromSaved(report: Report): Texts {
  const actions = [...report.actions];
  while (actions.length < 3) actions.push('');
  return {
    good: report.good ?? '',
    bad: report.bad ?? '',
    why: report.why ?? '',
    actions,
    progress: report.progress ?? '',
    fromAi: report.fromAi,
  };
}

/** Default week: the finished week on Monday/Tuesday (evaluation day), otherwise this week. */
function defaultWeek(today: string): string {
  const weekday = (new Date(`${today}T12:00:00`).getDay() + 6) % 7;
  const week = isoWeekOf(today);
  return weekday <= 1 ? shiftWeek(week, -1) : week;
}

function Editor({ week, posts, saved }: { week: string; posts: readonly Post[]; saved?: Report }) {
  const goal = useGoal();
  const aiEnabled = useSettings((s) => s.aiEnabled);
  const model = useSettings((s) => s.aiModel);
  const draft = useMemo(() => {
    const { start } = weekRange(week);
    const baseline = totals(postsBetween(posts, addDays(start, -28), addDays(start, -1))).rate;
    return buildWeeklyReport({ week, posts, goal, baselineRate: baseline });
  }, [week, posts, goal]);
  const [texts, setTexts] = useState<Texts>(() => (saved ? fromSaved(saved) : fromDraft(draft)));
  const [busy, setBusy] = useState<'save' | 'ai' | null>(null);
  const latestMeasure = useMemo(() => {
    const { start, end } = weekRange(week);
    return postsBetween(posts, start, end)
      .map((post) => post.measuredAt)
      .sort()
      .at(-1);
  }, [posts, week]);

  const patch = (next: Partial<Texts>) => setTexts((current) => ({ ...current, ...next }));
  const markdown = () =>
    reportToMarkdown(
      { week, ...texts, actions: texts.actions.filter((action) => action.trim()) },
      draft.facts,
    );

  const save = async () => {
    setBusy('save');
    try {
      const input = {
        week,
        good: texts.good,
        bad: texts.bad,
        why: texts.why,
        actions: texts.actions.map((action) => action.trim()).filter(Boolean),
        progress: texts.progress,
        fromAi: texts.fromAi,
      };
      if (saved) await reportsRepo.update(saved.id, input);
      else await reportsRepo.create(input);
      toast.success(t.savedToast);
    } finally {
      setBusy(null);
    }
  };

  const rewrite = async () => {
    setBusy('ai');
    try {
      const answer = await generate({ model, prompt: reportPrompt(draft), maxTokens: 2_000 });
      const parsed = parseReportAnswer(answer);
      if (!parsed) {
        toast.error(de.settings.ai.errors.unknown);
        return;
      }
      const actions = [...parsed.actions];
      while (actions.length < 3) actions.push('');
      patch({ ...parsed, actions, fromAi: true });
      toast.success(t.claudeDone);
    } catch (error: unknown) {
      toast.error(de.settings.ai.errors[error instanceof AiError ? error.reason : 'unknown']);
    } finally {
      setBusy(null);
    }
  };

  const field = (key: 'good' | 'bad' | 'why' | 'progress') => (
    <Textarea
      label={labels[key]}
      rows={3}
      value={texts[key]}
      onChange={(event) => patch({ [key]: event.target.value })}
      data-testid={`report-${key}`}
    />
  );

  return (
    <div className="flex flex-col gap-4" data-testid="report-editor">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Badge tone={saved ? 'success' : 'neutral'}>{saved ? t.saved : t.draft}</Badge>
        {texts.fromAi && <Badge tone="signal">{t.fromClaude}</Badge>}
        {latestMeasure && (
          <span className="text-sm text-fg-muted">
            {t.asOf(formatDay(localDateOf(new Date(latestMeasure))))}
          </span>
        )}
      </div>
      <Surface padding="sm" tone="sunken" className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-fg-secondary">{t.facts}</span>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-fg" data-testid="report-facts">
          {draft.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </Surface>
      {field('good')}
      {field('bad')}
      {field('why')}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 px-1 text-sm font-medium text-fg-secondary">
          {labels.actions}
        </legend>
        {texts.actions.map((action, index) => (
          <Input
            key={index}
            aria-label={t.action(index + 1)}
            value={action}
            onChange={(event) =>
              patch({
                actions: texts.actions.map((item, i) => (i === index ? event.target.value : item)),
              })
            }
            data-testid={`report-action-${index + 1}`}
          />
        ))}
      </fieldset>
      {field('progress')}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          icon={Save}
          loading={busy === 'save'}
          onClick={() => void save()}
          data-testid="report-save"
        >
          {t.save}
        </Button>
        {aiEnabled && (
          <Button
            variant="secondary"
            icon={Sparkles}
            loading={busy === 'ai'}
            disabled={busy !== null}
            onClick={() => void rewrite()}
            data-testid="report-claude"
          >
            {t.claude}
          </Button>
        )}
        <Button
          variant="secondary"
          icon={Copy}
          onClick={() =>
            void copyText(markdown()).then((ok) => {
              if (ok) toast.success(t.copied);
            })
          }
          data-testid="report-copy"
        >
          {t.copy}
        </Button>
        <Button
          variant="ghost"
          icon={Download}
          onClick={() =>
            void saveFile(
              new Blob([markdown()], { type: 'text/markdown' }),
              `wochenreport-${week}.md`,
            )
          }
          data-testid="report-download"
        >
          {t.download}
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={() => setTexts(fromDraft(draft))}>
          {t.reset}
        </Button>
      </div>
    </div>
  );
}

/** Weekly report JJJJ-KW: rule-based draft, editable, optionally rewritten by Claude. */
export function ReportTab({ posts }: { posts: readonly Post[] }) {
  const [week, setWeek] = useState(() => defaultWeek(localDateOf()));
  const reports = useDataStore((s) => s.reports);
  const saved = useMemo(
    () => Object.values(reports).find((report) => report.week === week),
    [reports, week],
  );
  const range = weekRange(week);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IconButton
          icon={ChevronLeft}
          label={t.prev}
          onClick={() => setWeek(shiftWeek(week, -1))}
        />
        <h2
          className="min-w-0 flex-1 text-center text-lg font-semibold text-fg"
          data-testid="report-week"
        >
          {de.stats.weekLabel(week, formatDay(range.start), formatDay(range.end))}
        </h2>
        <IconButton
          icon={ChevronRight}
          label={t.next}
          onClick={() => setWeek(shiftWeek(week, 1))}
        />
      </div>
      <Editor key={`${week}:${saved?.id ?? 'new'}`} week={week} posts={posts} saved={saved} />
    </div>
  );
}
