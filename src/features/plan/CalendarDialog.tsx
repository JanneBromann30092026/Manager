import { useState } from 'react';
import { CalendarPlus, Share } from 'lucide-react';
import { Button, Modal, toast } from '@/components/ui';
import { buildIcs } from '@/core/ics';
import { planEvents } from '@/core/plan';
import type { PlanItem } from '@/data/schemas';
import { PLAN_KIND_LABELS, PLAN_TEXTS } from '@/data/templates';
import { de } from '@/i18n/de';
import { dayLabel } from './planData';

const t = de.plan.calendarDialog;
const PREVIEW = 6;

function createFile(week: string, items: readonly PlanItem[]) {
  const events = planEvents(items, PLAN_KIND_LABELS, PLAN_TEXTS.calendarDescription);
  const ics = buildIcs(events, new Date(), { alarm: t.alarm, alarmHours: 9 });
  return { events, file: new File([ics], t.fileName(week), { type: 'text/calendar' }) };
}

/**
 * Calendar export of the open tasks (.ics), as in Kompass. The file is created when the dialog
 * opens, so sharing runs directly in the tap (iPadOS needs a fresh user gesture).
 */
function Content({
  week,
  items,
  onClose,
}: {
  week: string;
  items: readonly PlanItem[];
  onClose: () => void;
}) {
  const [{ file, events }] = useState(() => createFile(week, items));
  const canShare =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = () => {
    navigator.share({ files: [file], title: t.title }).then(onClose, (error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(t.shareFailed);
    });
  };

  const download = () => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (events.length === 0) return <p className="text-base text-fg-secondary">{t.none}</p>;

  return (
    <div className="flex flex-col gap-4" data-testid="calendar-dialog">
      <p className="text-base text-fg-secondary">{t.text(events.length)}</p>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg-secondary">{t.preview}</p>
        <ul className="flex flex-col gap-1.5" data-testid="calendar-preview">
          {events.slice(0, PREVIEW).map((event) => (
            <li
              key={event.uid}
              className="flex gap-3 rounded-lg bg-surface-sunken px-3 py-2 text-base"
            >
              <span className="w-24 shrink-0 text-fg-secondary tabular-nums">
                {dayLabel(event.date)}
              </span>
              <span className="min-w-0 truncate text-fg">{event.summary}</span>
            </li>
          ))}
        </ul>
        {events.length > PREVIEW && (
          <p className="text-sm text-fg-muted">{t.more(events.length - PREVIEW)}</p>
        )}
      </div>
      <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-fg">{t.hint}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={canShare ? 'secondary' : 'primary'}
          icon={CalendarPlus}
          onClick={download}
          data-testid="calendar-download"
        >
          {t.download}
        </Button>
        {canShare && (
          <Button icon={Share} onClick={share} data-testid="calendar-share">
            {t.share}
          </Button>
        )}
      </div>
    </div>
  );
}

export function CalendarDialog({
  open,
  week,
  items,
  onClose,
}: {
  open: boolean;
  week: string;
  items: readonly PlanItem[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t.title}>
      {open && <Content week={week} items={items} onClose={onClose} />}
    </Modal>
  );
}
