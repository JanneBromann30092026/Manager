import { useMemo, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { Badge, Button, Modal, Textarea, toast } from '@/components/ui';
import { importPostsCsv, planImport } from '@/core/csvImport';
import { de } from '@/i18n/de';
import { applyImport } from './statsActions';
import { usePosts } from './statsData';

const t = de.stats.import;
const f = de.stats.form;

const FIELD_LABELS: Record<string, string> = {
  date: f.date,
  platform: f.platform,
  format: f.format,
  topic: f.topic,
  hookType: f.hookType,
  views: f.views,
  nonFollowerPct: f.nonFollowerPct,
  avgWatchSeconds: f.avgWatchSeconds,
  likes: f.likes,
  comments: f.comments,
  shares: f.shares,
  saves: f.saves,
  newFollowers: f.newFollowers,
  lengthSeconds: f.lengthSeconds,
  halfGoneSeconds: f.halfGoneSeconds,
  endHoldPct: f.endHoldPct,
  stories: 'Stories',
  reelsTab: 'Reels-Tab',
  feed: 'Feed',
  profile: 'Profil',
  explore: 'Explore',
  notes: f.notes,
};

function Form({ onClose }: { onClose: () => void }) {
  const posts = usePosts();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const result = useMemo(() => (text.trim() ? importPostsCsv(text) : null), [text]);
  const plans = useMemo(
    () =>
      result
        ? planImport(
            posts,
            result.drafts.map((row) => row.draft),
          )
        : [],
    [posts, result],
  );
  const created = plans.filter((plan) => plan.kind === 'create').length;
  const updated = plans.length - created;

  const readFile = async (file: File) => {
    try {
      setText(await file.text());
    } catch {
      toast.error(t.readFailed);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const done = await applyImport(plans);
      toast.success(t.done(done.created, done.updated));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="import-form">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full bg-accent px-5 text-base font-medium text-on-accent shadow-card">
        <FileUp size={18} aria-hidden />
        {t.file}
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          data-testid="import-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = '';
          }}
        />
      </label>
      <Textarea
        label={t.paste}
        rows={5}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="font-mono text-sm"
        data-testid="import-text"
      />
      {result && (
        <section className="flex flex-col gap-3" data-testid="import-preview" aria-live="polite">
          {result.recognized.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="px-1 text-sm font-medium text-fg-secondary">{t.recognized}</span>
              <div className="flex flex-wrap gap-1.5">
                {result.recognized.map((field) => (
                  <Badge key={field} tone="accent">
                    {FIELD_LABELS[field] ?? field}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {result.unknownColumns.length > 0 && (
            <p className="px-1 text-sm text-fg-muted">
              {t.unknown(result.unknownColumns.join(', '))}
            </p>
          )}
          <p className="px-1 text-base font-medium text-fg" data-testid="import-summary">
            {plans.length > 0 ? t.summary(created, updated) : t.nothing}
          </p>
          {result.errors.length > 0 && (
            <div
              className="rounded-xl bg-warning-soft p-3 text-sm text-fg"
              data-testid="import-errors"
            >
              <p className="font-medium">{t.errorsTitle}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.errors.slice(0, 20).map((error, index) => (
                  <li key={index}>
                    {error.code === 'date'
                      ? t.errorDate(error.line)
                      : t.errorValue(
                          error.line,
                          FIELD_LABELS[error.column ?? ''] ?? error.column ?? '',
                        )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      <Button
        icon={Upload}
        className="self-start"
        loading={busy}
        disabled={plans.length === 0 || busy}
        onClick={() => void run()}
        data-testid="import-run"
      >
        {t.run}
      </Button>
    </div>
  );
}

/** CSV import of performance.csv / retention.csv with preview. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={t.title} description={t.text} size="lg">
      {open && <Form onClose={onClose} />}
    </Modal>
  );
}
