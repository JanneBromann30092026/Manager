import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Clapperboard, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea, Toggle, toast } from '@/components/ui';
import { weekDays } from '@/core/plan';
import { PLAN_ITEM_KINDS, type PlanItemKind } from '@/data/domain';
import type { PlanItem } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { PLAN_KIND_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { useSettings } from '@/features/settings/settingsStore';
import { dayLabel, markIdeasPlanned, parseMinutes, savePlanItems } from './planData';

const t = de.plan.form;
const kindOptions = PLAN_ITEM_KINDS.map((value) => ({ value, label: PLAN_KIND_LABELS[value] }));

function Form({
  week,
  items,
  item,
  defaultDate,
  onClose,
}: {
  week: string;
  items: readonly PlanItem[];
  item: PlanItem | undefined;
  defaultDate: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const durations = useSettings((s) => s.planDurations);
  const idea = useDataStore((s) => (item?.ideaId ? s.ideas[item.ideaId] : undefined));
  const videoId = item?.videoId ?? idea?.videoId;
  const [kind, setKind] = useState<PlanItemKind>(item?.kind ?? 'reel');
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [title, setTitle] = useState(item?.title ?? '');
  const [minutes, setMinutes] = useState(String(item?.minutes ?? durations.reel));
  const [minutesTouched, setMinutesTouched] = useState(item !== undefined);
  const [done, setDone] = useState(item?.done ?? false);
  const [errors, setErrors] = useState<{ title?: string; minutes?: string }>({});
  const [busy, setBusy] = useState(false);

  const dayOptions = weekDays(week).map((value) => ({ value, label: dayLabel(value, 'long') }));

  const save = async (): Promise<boolean> => {
    const parsed = parseMinutes(minutes);
    const next = {
      title: title.trim() ? undefined : t.titleRequired,
      minutes: parsed === undefined ? t.minutesInvalid : undefined,
    };
    setErrors(next);
    if (next.title || next.minutes || parsed === undefined) return false;
    setBusy(true);
    try {
      const updated: PlanItem = {
        ...(item ?? { id: crypto.randomUUID() }),
        kind,
        date,
        title: title.trim(),
        minutes: parsed,
        done,
      };
      const list = item
        ? items.map((entry) => (entry.id === item.id ? updated : entry))
        : [...items, updated];
      await savePlanItems(week, list);
      await markIdeasPlanned([updated]);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    await savePlanItems(
      week,
      items.filter((entry) => entry.id !== item.id),
    );
    toast.info(t.deleted);
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="plan-item-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save().then((ok) => ok && onClose());
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t.kind}
          options={kindOptions}
          value={kind}
          onChange={(value) => {
            setKind(value);
            if (!minutesTouched) setMinutes(String(durations[value]));
          }}
          data-testid="plan-item-kind"
        />
        <Select
          label={t.day}
          options={dayOptions}
          value={date}
          onChange={setDate}
          data-testid="plan-item-day"
        />
      </div>
      <Textarea
        label={t.title}
        rows={2}
        value={title}
        error={errors.title}
        autoFocus={!item}
        onChange={(event) => {
          setTitle(event.target.value);
          setErrors((current) => ({ ...current, title: undefined }));
        }}
        data-testid="plan-item-title"
      />
      <Input
        label={t.minutes}
        inputMode="numeric"
        value={minutes}
        error={errors.minutes}
        onChange={(event) => {
          setMinutesTouched(true);
          setMinutes(event.target.value);
          setErrors((current) => ({ ...current, minutes: undefined }));
        }}
        data-testid="plan-item-minutes"
      />
      {item && <Toggle label={t.done} checked={done} onChange={setDone} />}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="submit" loading={busy} data-testid="plan-item-save">
          {item ? t.save : t.create}
        </Button>
        {item && (videoId || item.ideaId) && (
          <Button
            type="button"
            variant="secondary"
            icon={Clapperboard}
            onClick={() =>
              void save().then((ok) => {
                if (!ok) return;
                onClose();
                void navigate(videoId ? `/videos/${videoId}` : `/videos?idea=${item.ideaId}`);
              })
            }
            data-testid="plan-item-video"
          >
            {videoId ? t.toVideo : t.startVideo}
          </Button>
        )}
        {item && (
          <Button
            type="button"
            variant="ghost"
            icon={Trash2}
            className="ml-auto"
            onClick={() => void remove()}
            data-testid="plan-item-delete"
          >
            {t.delete}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Create or edit one task of the weekly plan. */
export function PlanItemEditor({
  open,
  week,
  items,
  item,
  defaultDate,
  onClose,
}: {
  open: boolean;
  week: string;
  items: readonly PlanItem[];
  item: PlanItem | undefined;
  defaultDate: string;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={item ? t.editTitle : t.newTitle}>
      {open && (
        <Form
          key={item?.id ?? 'new'}
          week={week}
          items={items}
          item={item}
          defaultDate={defaultDate}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
