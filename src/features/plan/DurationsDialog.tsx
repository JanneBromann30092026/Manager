import { useState } from 'react';
import { Button, Input, Modal, toast } from '@/components/ui';
import { PLAN_ITEM_KINDS, type PlanItemKind } from '@/data/domain';
import { PLAN_BUDGET_MINUTES, PLAN_DEFAULT_MINUTES, PLAN_KIND_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { useSettings } from '@/features/settings/settingsStore';
import { parseMinutes, setPlanBudget } from './planData';

const t = de.plan.durationsDialog;

type Draft = { budget: string } & Record<PlanItemKind, string>;

function toDraft(budget: number, durations: Record<PlanItemKind, number>): Draft {
  return {
    budget: String(budget),
    ...(Object.fromEntries(
      PLAN_ITEM_KINDS.map((kind) => [kind, String(durations[kind])]),
    ) as Record<PlanItemKind, string>),
  };
}

function Form({ week, onClose }: { week: string; onClose: () => void }) {
  const budget = useSettings((s) => s.planBudget);
  const durations = useSettings((s) => s.planDurations);
  const set = useSettings((s) => s.set);
  const [draft, setDraft] = useState(() => toDraft(budget, durations));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const nextBudget = parseMinutes(draft.budget, 30, 40 * 60);
    const next = Object.fromEntries(
      PLAN_ITEM_KINDS.map((kind) => [kind, parseMinutes(draft[kind])]),
    ) as Record<PlanItemKind, number | undefined>;
    if (nextBudget === undefined || PLAN_ITEM_KINDS.some((kind) => next[kind] === undefined)) {
      setError(t.invalid);
      return;
    }
    await set('planBudget', nextBudget);
    await set('planDurations', next as Record<PlanItemKind, number>);
    await setPlanBudget(week, nextBudget);
    toast.success(t.saved);
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="durations-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Input
        label={t.budget}
        hint={t.budgetHint}
        inputMode="numeric"
        value={draft.budget}
        onChange={(event) => setDraft({ ...draft, budget: event.target.value })}
        data-testid="durations-budget"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {PLAN_ITEM_KINDS.map((kind) => (
          <Input
            key={kind}
            label={t.perKind(PLAN_KIND_LABELS[kind])}
            inputMode="numeric"
            value={draft[kind]}
            onChange={(event) => setDraft({ ...draft, [kind]: event.target.value })}
            data-testid={`durations-${kind}`}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" data-testid="durations-save">
          {t.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null);
            setDraft(toDraft(PLAN_BUDGET_MINUTES, PLAN_DEFAULT_MINUTES));
          }}
        >
          {t.reset}
        </Button>
      </div>
    </form>
  );
}

/** Time budget and time per task (template for suggestions and new tasks). */
export function DurationsDialog({
  open,
  week,
  onClose,
}: {
  open: boolean;
  week: string;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t.title} description={t.text}>
      {open && <Form week={week} onClose={onClose} />}
    </Modal>
  );
}
