import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  ActionMenuButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  ProgressBar,
  Surface,
  cn,
  toast,
  type BadgeTone,
} from '@/components/ui';
import { Page } from '@/app/shell/Page';
import { isoWeekOf, localDateOf, shiftWeek, weekRange } from '@/core/dates';
import {
  dayOfWeek,
  formatMinutes,
  plannedElsewhere,
  reelCandidates,
  summarizePlan,
  weekDays,
} from '@/core/plan';
import { isoWeek, type PlanItem } from '@/data/schemas';
import type { PlanItemKind } from '@/data/domain';
import { useDataStore } from '@/data/store';
import { PLAN_KIND_LABELS, PLAN_SLOTS, PLAN_TEXTS } from '@/data/templates';
import { de } from '@/i18n/de';
import { useSettings } from '@/features/settings/settingsStore';
import { formatDay } from '@/features/stats/statsData';
import { CalendarDialog } from './CalendarDialog';
import { DurationsDialog } from './DurationsDialog';
import { PlanItemEditor } from './PlanItemEditor';
import { createSuggestion, dayLabel, markIdeasPlanned, savePlanItems, usePlan } from './planData';

const t = de.plan;

const KIND_TONES: Record<PlanItemKind, BadgeTone> = {
  reel: 'accent',
  podcast: 'accent',
  qa: 'signal',
  story: 'neutral',
  other: 'neutral',
};

type Dialog =
  | { kind: 'item'; item?: PlanItem; date: string }
  | { kind: 'durations' }
  | { kind: 'calendar' }
  | { kind: 'resuggest' }
  | null;

function BudgetCard({
  items,
  budget,
  onAddQa,
}: {
  items: readonly PlanItem[];
  budget: number;
  onAddQa: () => void;
}) {
  const summary = summarizePlan(items, budget);
  const over = summary.warnings.includes('overBudget');
  return (
    <Surface padding="md" className="flex flex-col gap-3" data-testid="plan-budget">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{t.budget}</h2>
        <span className="text-sm text-fg-secondary tabular-nums" data-testid="plan-budget-used">
          {t.budgetUsed(formatMinutes(summary.used), formatMinutes(budget))}
        </span>
      </div>
      <ProgressBar value={summary.fraction} label={t.budget} tone={over ? 'warning' : 'accent'} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span
          className={cn('font-medium', over ? 'text-warning' : 'text-fg-secondary')}
          data-testid="plan-budget-left"
        >
          {over
            ? t.budgetOver(formatMinutes(-summary.remaining))
            : t.budgetLeft(formatMinutes(summary.remaining))}
        </span>
        {summary.total > 0 && (
          <span className="text-fg-muted">{t.progress(summary.done, summary.total)}</span>
        )}
      </div>
      {summary.warnings.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="plan-warnings">
          {summary.warnings.map((warning) => (
            <li
              key={warning}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-fg"
            >
              <span className="min-w-0 flex-1">{t.warnings[warning]}</span>
              {warning === 'noQa' && (
                <Button size="sm" variant="secondary" icon={Plus} onClick={onAddQa}>
                  {t.addQa}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

function ItemRow({
  item,
  onOpen,
  onToggle,
}: {
  item: PlanItem;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <li
      className="flex items-center gap-1 rounded-2xl bg-surface shadow-card"
      data-testid="plan-item"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={t.markDone(item.title)}
        onClick={onToggle}
        className="flex size-12 shrink-0 items-center justify-center rounded-full"
        data-testid="plan-item-done"
      >
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full border-2 transition-colors',
            item.done ? 'border-success bg-success text-on-success' : 'border-line-strong',
          )}
        >
          {item.done && <Check size={16} strokeWidth={3} aria-hidden />}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-4 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              'text-base font-medium text-fg',
              item.done && 'text-fg-muted line-through',
            )}
          >
            {item.title}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={KIND_TONES[item.kind]}>{PLAN_KIND_LABELS[item.kind]}</Badge>
          </span>
        </span>
        <span className="shrink-0 text-sm text-fg-secondary tabular-nums">
          {t.minutes(item.minutes)}
        </span>
      </button>
    </li>
  );
}

function NextTopics({ week, items }: { week: string; items: readonly PlanItem[] }) {
  const ideasMap = useDataStore((s) => s.ideas);
  const videosMap = useDataStore((s) => s.videos);
  const plans = useDataStore((s) => s.plans);
  const durations = useSettings((s) => s.planDurations);
  const candidates = useMemo(() => {
    const exclude = plannedElsewhere(Object.values(plans), week, isoWeekOf(localDateOf()));
    for (const item of items) {
      if (item.ideaId) exclude.add(item.ideaId);
      if (item.videoId) exclude.add(item.videoId);
    }
    return reelCandidates({
      ideas: Object.values(ideasMap),
      videos: Object.values(videosMap),
      durations,
      excludeIds: exclude,
    }).slice(0, 4);
  }, [week, items, ideasMap, videosMap, durations, plans]);

  const add = async (candidate: (typeof candidates)[number]) => {
    const reelDays = new Set(
      items.filter((item) => item.kind === 'reel' || item.kind === 'podcast').map((i) => i.date),
    );
    const free = [...PLAN_SLOTS.reels, 6, 1, 5, 3, 7]
      .map((day) => dayOfWeek(week, day))
      .find((date) => !reelDays.has(date));
    const item: PlanItem = {
      id: crypto.randomUUID(),
      date: free ?? dayOfWeek(week, PLAN_SLOTS.reels[0]),
      kind: candidate.kind,
      title: candidate.title,
      minutes: candidate.minutes,
      ideaId: candidate.ideaId,
      videoId: candidate.videoId,
      done: false,
    };
    await savePlanItems(week, [...items, item]);
    await markIdeasPlanned([item]);
    toast.success(t.topicAdded);
  };

  return (
    <Surface padding="md" className="flex flex-col gap-3" data-testid="plan-next">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-fg">{t.next}</h2>
        <p className="text-sm text-fg-muted">{t.nextHint}</p>
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-fg-secondary">{t.nextEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {candidates.map((candidate) => (
            <li
              key={candidate.videoId ?? candidate.ideaId}
              className="flex items-center gap-2 py-1.5"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-fg">{candidate.title}</span>
                <span className="text-sm text-fg-muted">
                  {PLAN_KIND_LABELS[candidate.kind]} · {t.minutes(candidate.minutes)}
                </span>
              </span>
              <IconButton
                icon={Plus}
                label={t.addTopic(candidate.title)}
                variant="secondary"
                onClick={() => void add(candidate)}
                data-testid="plan-next-add"
              />
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

/** Weekly plan: Reels, Stories and Q&A for a week within the time budget. */
export function PlanPage() {
  const [params, setParams] = useSearchParams();
  const today = localDateOf();
  const currentWeek = isoWeekOf(today);
  const paramWeek = params.get('week');
  const week =
    paramWeek && isoWeek.safeParse(paramWeek).success ? paramWeek : shiftWeek(currentWeek, 1);
  const plan = usePlan(week);
  const defaultBudget = useSettings((s) => s.planBudget);
  const durations = useSettings((s) => s.planDurations);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const items = plan?.items ?? [];
  const budget = plan?.budgetMinutes ?? defaultBudget;
  const days = weekDays(week);
  const range = weekRange(week);
  const firstFreeDay = days.find((date) => !items.some((item) => item.date === date)) ?? days[0]!;

  const goTo = (next: string) => setParams({ week: next }, { replace: true });

  const suggest = async () => {
    setBusy(true);
    try {
      const skipped = await createSuggestion(week);
      toast.success(t.suggested(skipped));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (item: PlanItem) =>
    void savePlanItems(
      week,
      items.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)),
    );

  const addQa = () =>
    void savePlanItems(week, [
      ...items,
      {
        id: crypto.randomUUID(),
        date: dayOfWeek(week, PLAN_SLOTS.qa),
        kind: 'qa',
        title: PLAN_TEXTS.qaTitle,
        minutes: durations.qa,
        done: false,
      },
    ]);

  const weekBadge =
    week === currentWeek
      ? t.thisWeekBadge
      : week === shiftWeek(currentWeek, 1)
        ? t.nextWeekBadge
        : null;

  return (
    <Page
      title={t.title}
      actions={
        <>
          <ActionMenuButton
            label={t.menu}
            testId="plan-menu"
            items={[
              {
                id: 'durations',
                label: t.durations,
                icon: Clock,
                onSelect: () => setDialog({ kind: 'durations' }),
              },
              {
                id: 'resuggest',
                label: t.resuggest,
                icon: RefreshCw,
                disabled: !plan,
                onSelect: () => setDialog({ kind: 'resuggest' }),
              },
            ]}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={CalendarPlus}
            disabled={items.length === 0}
            onClick={() => setDialog({ kind: 'calendar' })}
            data-testid="plan-calendar"
          >
            <span className="max-[30rem]:sr-only">{t.calendar}</span>
          </Button>
          <Button
            size="sm"
            icon={Plus}
            onClick={() => setDialog({ kind: 'item', date: firstFreeDay })}
            data-testid="plan-add"
          >
            <span className="max-[30rem]:sr-only">{t.add}</span>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex items-center gap-2" data-testid="plan-week-nav">
          <IconButton
            icon={ChevronLeft}
            label={t.prevWeek}
            onClick={() => goTo(shiftWeek(week, -1))}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 text-center">
            <span className="text-base font-semibold text-fg" data-testid="plan-week">
              {t.weekLabel(week, formatDay(range.start), formatDay(range.end))}
            </span>
            {weekBadge && <Badge tone="signal">{weekBadge}</Badge>}
          </div>
          <IconButton
            icon={ChevronRight}
            label={t.nextWeek}
            onClick={() => goTo(shiftWeek(week, 1))}
          />
        </div>

        {!plan ? (
          <EmptyState
            title={t.emptyTitle(week)}
            text={t.emptyText}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  icon={Sparkles}
                  loading={busy}
                  onClick={() => void suggest()}
                  data-testid="plan-suggest"
                >
                  {t.suggest}
                </Button>
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setDialog({ kind: 'item', date: firstFreeDay })}
                >
                  {t.startEmpty}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-4 wide:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-4">
              <BudgetCard items={items} budget={budget} onAddQa={addQa} />
              {days.map((date) => {
                const dayItems = items.filter((item) => item.date === date);
                return (
                  <section key={date} className="flex flex-col gap-2" data-testid="plan-day">
                    <div className="flex items-center justify-between gap-2 px-2">
                      <h2
                        className={cn(
                          'text-sm font-semibold tracking-wide uppercase',
                          date === today ? 'text-accent-fg' : 'text-fg-muted',
                        )}
                      >
                        {dayLabel(date, 'long')}
                      </h2>
                      {dayItems.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'item', date })}
                          className="inline-flex min-h-11 items-center gap-1 text-sm text-fg-muted"
                          aria-label={`${t.addLong} – ${dayLabel(date, 'long')}`}
                        >
                          {t.free}
                          <Plus size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                    {dayItems.length > 0 && (
                      <ul className="flex flex-col gap-2">
                        {dayItems.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            onOpen={() => setDialog({ kind: 'item', item, date })}
                            onToggle={() => toggle(item)}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
            <div className="flex flex-col gap-4">
              <NextTopics week={week} items={items} />
            </div>
          </div>
        )}
      </div>

      <PlanItemEditor
        open={dialog?.kind === 'item'}
        week={week}
        items={items}
        item={dialog?.kind === 'item' ? dialog.item : undefined}
        defaultDate={dialog?.kind === 'item' ? dialog.date : firstFreeDay}
        onClose={() => setDialog(null)}
      />
      <DurationsDialog
        open={dialog?.kind === 'durations'}
        week={week}
        onClose={() => setDialog(null)}
      />
      <CalendarDialog
        open={dialog?.kind === 'calendar'}
        week={week}
        items={items}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'resuggest'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await suggest();
          setDialog(null);
        }}
        title={t.resuggestTitle}
        message={t.resuggestText}
        confirmLabel={t.resuggestConfirm}
        variant="primary"
      />
    </Page>
  );
}
