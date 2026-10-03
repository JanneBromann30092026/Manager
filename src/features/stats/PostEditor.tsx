import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Textarea,
  toast,
} from '@/components/ui';
import { parseNumber, type PostDraft } from '@/core/csvImport';
import { localDateOf } from '@/core/dates';
import { FORMATS, HOOK_TYPES, PLATFORMS, type ValueSource } from '@/data/domain';
import { postsRepo } from '@/data/repositories';
import type { Post, PostInput } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import {
  FORMAT_LABELS,
  HOOK_TEMPLATES,
  PLATFORM_LABELS,
  TRAFFIC_SOURCE_KEYS,
  TRAFFIC_SOURCE_LABELS,
  VALUE_SOURCE_LABELS,
} from '@/data/templates';
import { de } from '@/i18n/de';
import { formatDay } from './statsData';

const t = de.stats;
const f = t.form;

const NUMBER_FIELDS = [
  { key: 'views', max: 1_000_000_000, integer: true },
  { key: 'newFollowers', max: 1_000_000_000, integer: true },
  { key: 'nonFollowerPct', max: 100, integer: false },
  { key: 'avgWatchSeconds', max: 86_400, integer: false },
  { key: 'likes', max: 1_000_000_000, integer: true },
  { key: 'comments', max: 1_000_000_000, integer: true },
  { key: 'shares', max: 1_000_000_000, integer: true },
  { key: 'saves', max: 1_000_000_000, integer: true },
] as const;
const RETENTION_FIELDS = [
  { key: 'lengthSeconds', max: 86_400, integer: false },
  { key: 'halfGoneSeconds', max: 86_400, integer: false },
  { key: 'endHoldPct', max: 100, integer: false },
] as const;

type NumberKey = (typeof NUMBER_FIELDS)[number]['key'];
type RetentionKey = (typeof RETENTION_FIELDS)[number]['key'];
type SourceKey = (typeof TRAFFIC_SOURCE_KEYS)[number];
type FieldKey = NumberKey | RetentionKey | SourceKey;

const NONE = 'none';

/** Values Claude read from a screenshot (marked „abgelesen“ until saved). */
export interface PostPrefill {
  draft: Partial<PostDraft>;
  readFields: readonly string[];
}

interface Draft {
  date: string;
  platform: Post['platform'];
  format: Post['format'];
  topic: string;
  hookType: string;
  videoId: string;
  measuredAt: string;
  notes: string;
  values: Partial<Record<FieldKey, string>>;
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${localDateOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const text = (value: number | undefined) =>
  value === undefined ? undefined : String(value).replace('.', ',');

function toDraft(post: Post | undefined, prefill: PostPrefill | undefined): Draft {
  const source = post ?? prefill?.draft;
  const values: Draft['values'] = {};
  for (const { key } of NUMBER_FIELDS) values[key] = text(source?.[key]);
  for (const { key } of RETENTION_FIELDS) values[key] = text(source?.retention?.[key]);
  for (const key of TRAFFIC_SOURCE_KEYS) values[key] = text(source?.retention?.sources?.[key]);
  return {
    date: source?.date ?? localDateOf(),
    platform: source?.platform ?? 'instagram',
    format: source?.format ?? 'reel',
    topic: source?.topic ?? '',
    hookType: source?.hookType ?? NONE,
    videoId: post?.videoId ?? NONE,
    measuredAt: toLocalInput(post?.measuredAt ?? new Date().toISOString()),
    notes: source?.notes ?? '',
    values,
  };
}

function Form({
  post,
  prefill,
  onClose,
}: {
  post: Post | undefined;
  prefill: PostPrefill | undefined;
  onClose: () => void;
}) {
  const videos = useDataStore((s) => s.videos);
  const [draft, setDraft] = useState(() => toDraft(post, prefill));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const read = new Set(prefill?.readFields ?? []);
  const source: ValueSource = post?.source ?? (prefill ? 'screenshot' : 'manual');

  const videoOptions = useMemo(
    () => [
      { value: NONE, label: f.noVideo },
      ...Object.values(videos)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((video) => ({ value: video.id, label: `${formatDay(video.date)} · ${video.topic}` })),
    ],
    [videos],
  );

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const setValue = (key: FieldKey, value: string) => {
    setErrors((current) => ({ ...current, [key]: undefined }));
    setDraft((current) => ({ ...current, values: { ...current.values, [key]: value } }));
  };

  const parse = (): PostInput | null => {
    const nextErrors: typeof errors = {};
    const numbers: Partial<Record<FieldKey, number>> = {};
    const fields = [
      ...NUMBER_FIELDS,
      ...RETENTION_FIELDS,
      ...TRAFFIC_SOURCE_KEYS.map((key) => ({ key, max: 100, integer: false })),
    ];
    for (const { key, max, integer } of fields) {
      const raw = draft.values[key]?.trim() ?? '';
      if (!raw) continue;
      const value = parseNumber(raw);
      if (value === undefined) nextErrors[key] = f.invalid;
      else if (value < 0 || value > max) nextErrors[key] = f.tooHigh(max);
      else numbers[key] = integer ? Math.round(value) : value;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;
    const sources = Object.fromEntries(
      TRAFFIC_SOURCE_KEYS.filter((key) => numbers[key] !== undefined).map((key) => [
        key,
        numbers[key],
      ]),
    );
    const retention = {
      lengthSeconds: numbers.lengthSeconds,
      halfGoneSeconds: numbers.halfGoneSeconds,
      endHoldPct: numbers.endHoldPct,
      sources: Object.keys(sources).length > 0 ? sources : undefined,
    };
    const hasRetention = Object.values(retention).some((value) => value !== undefined);
    const video = draft.videoId === NONE ? undefined : videos[draft.videoId];
    return {
      date: draft.date,
      platform: draft.platform,
      format: draft.format,
      topic: draft.topic.trim() || video?.topic,
      hookType: draft.hookType === NONE ? undefined : (draft.hookType as Post['hookType']),
      videoId: video?.id,
      measuredAt: new Date(draft.measuredAt).toISOString(),
      source,
      views: numbers.views,
      newFollowers: numbers.newFollowers,
      nonFollowerPct: numbers.nonFollowerPct,
      avgWatchSeconds: numbers.avgWatchSeconds,
      likes: numbers.likes,
      comments: numbers.comments,
      shares: numbers.shares,
      saves: numbers.saves,
      retention: hasRetention ? retention : undefined,
      notes: draft.notes,
    };
  };

  const save = async () => {
    const input = parse();
    if (!input) return;
    setBusy(true);
    try {
      if (post) await postsRepo.update(post.id, input);
      else await postsRepo.create(input);
      toast.success(post ? t.saved : t.created);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const numberInput = (key: FieldKey, label: string) => (
    <Input
      key={key}
      label={label}
      inputMode="decimal"
      autoComplete="off"
      value={draft.values[key] ?? ''}
      error={errors[key]}
      hint={read.has(key) ? f.read : undefined}
      onChange={(event) => setValue(key, event.target.value)}
      data-testid={`post-${key}`}
      data-read={read.has(key) ? 'true' : undefined}
      className={read.has(key) ? 'ring-2 ring-signal' : undefined}
    />
  );

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="post-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {prefill && (
        <p
          role="status"
          className="rounded-xl bg-signal-soft p-3 text-sm text-fg"
          data-testid="post-read-hint"
        >
          {f.readHint}
        </p>
      )}
      {post && (
        <div>
          <Badge tone={post.source === 'screenshot' ? 'signal' : 'neutral'}>
            {f.source(VALUE_SOURCE_LABELS[post.source])}
          </Badge>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={f.date}
          type="date"
          required
          value={draft.date}
          onChange={(event) => patch({ date: event.target.value })}
          data-testid="post-date"
        />
        <Input
          label={f.measuredAt}
          hint={f.measuredAtHint}
          type="datetime-local"
          required
          value={draft.measuredAt}
          onChange={(event) => patch({ measuredAt: event.target.value })}
          data-testid="post-measured"
        />
        <Select
          label={f.platform}
          options={PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
          value={draft.platform}
          onChange={(platform) => patch({ platform })}
          data-testid="post-platform"
        />
        <Select
          label={f.format}
          options={FORMATS.map((value) => ({ value, label: FORMAT_LABELS[value] }))}
          value={draft.format}
          onChange={(format) => patch({ format })}
          data-testid="post-format"
        />
      </div>
      <Input
        label={f.topic}
        placeholder={f.topicPlaceholder}
        value={draft.topic}
        onChange={(event) => patch({ topic: event.target.value })}
        data-testid="post-topic"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={f.video}
          options={videoOptions}
          value={draft.videoId}
          onChange={(videoId) => {
            const video = videos[videoId];
            patch({
              videoId,
              ...(video && !draft.topic.trim() ? { topic: video.topic } : {}),
              ...(video?.hookType && draft.hookType === NONE ? { hookType: video.hookType } : {}),
            });
          }}
          data-testid="post-video"
        />
        <Select
          label={f.hookType}
          options={[
            { value: NONE, label: f.hookNone },
            ...HOOK_TYPES.map((value) => ({ value, label: HOOK_TEMPLATES[value].label })),
          ]}
          value={draft.hookType}
          onChange={(hookType) => patch({ hookType })}
        />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 flex flex-col px-1">
          <span className="text-base font-semibold text-fg">{f.numbers}</span>
          <span className="text-sm text-fg-muted">{f.numbersHint}</span>
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUMBER_FIELDS.map(({ key }) => numberInput(key, f[key]))}
        </div>
      </fieldset>
      <details
        className="rounded-xl bg-surface-sunken p-4"
        open={RETENTION_FIELDS.some(({ key }) => draft.values[key]) || undefined}
      >
        <summary className="min-h-11 cursor-pointer content-center font-medium text-fg">
          {f.retention}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {RETENTION_FIELDS.map(({ key }) => numberInput(key, f[key]))}
          </div>
          <span className="px-1 text-sm font-medium text-fg-secondary">{f.sources}</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {TRAFFIC_SOURCE_KEYS.map((key) => numberInput(key, TRAFFIC_SOURCE_LABELS[key]))}
          </div>
        </div>
      </details>
      <Textarea
        label={f.notes}
        rows={2}
        value={draft.notes}
        onChange={(event) => patch({ notes: event.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="submit" loading={busy} data-testid="post-save">
          {prefill ? f.confirmRead : post ? f.save : f.create}
        </Button>
        {post && (
          <Button
            type="button"
            variant="ghost"
            icon={Trash2}
            className="ml-auto"
            onClick={() => setDeleting(true)}
          >
            {f.delete}
          </Button>
        )}
      </div>
      {post && (
        <ConfirmDialog
          open={deleting}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await postsRepo.remove(post.id);
            toast.info(t.deleted);
            onClose();
          }}
          title={f.deleteTitle}
          message={f.deleteText}
          confirmLabel={f.delete}
        />
      )}
    </form>
  );
}

/** Create or edit one post (all fields of the evaluation incl. retention and sources). */
export function PostEditor({
  open,
  post,
  prefill,
  onClose,
}: {
  open: boolean;
  post: Post | undefined;
  prefill?: PostPrefill;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={post ? f.editTitle : f.newTitle} size="lg">
      {open && <Form key={post?.id ?? 'new'} post={post} prefill={prefill} onClose={onClose} />}
    </Modal>
  );
}
