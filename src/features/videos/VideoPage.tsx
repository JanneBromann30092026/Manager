import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Sparkles, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Select,
  Surface,
  Textarea,
  cn,
  toast,
} from '@/components/ui';
import { Page } from '@/app/shell/Page';
import { nextCta } from '@/core/cta';
import { CTA_TYPES, HOOK_TYPES, VIDEO_STATUSES, type HookType } from '@/data/domain';
import { selectBrand, videosRepo } from '@/data/repositories';
import type { Video } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import {
  blocksFor,
  CTA_TEMPLATES,
  HOOK_TEMPLATES,
  VIDEO_BLOCK_TEMPLATES,
  VIDEO_KIND_LABELS,
  VIDEO_STATUS_LABELS,
} from '@/data/templates';
import { useSettings } from '@/features/settings/settingsStore';
import { de } from '@/i18n/de';
import { AiError } from '@/services/ai/client';
import { BlockCard } from './BlockCard';
import { CheckCard } from './CheckCard';
import { generateBlock, setVideoCta, setVideoStatus } from './videoActions';
import { formatDate, VIDEO_STATUS_TONES } from './videoFormat';

const t = de.videos.detail;

const NO_HOOK = 'none' as const;
const hookOptions: { value: HookType | typeof NO_HOOK; label: string }[] = [
  { value: NO_HOOK, label: t.hookNone },
  ...HOOK_TYPES.map((value) => ({ value, label: HOOK_TEMPLATES[value].label })),
];
const ctaOptions = CTA_TYPES.map((value) => ({
  value,
  label: `${CTA_TEMPLATES[value].label} – ${CTA_TEMPLATES[value].example}`,
}));

const timeFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

/** Status flow as a row of steps; tapping a step sets the status. */
function StatusSteps({ video }: { video: Video }) {
  const current = VIDEO_STATUSES.indexOf(video.status);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={t.status} data-testid="video-status">
      {VIDEO_STATUSES.map((status, index) => (
        <li key={status} className="min-w-[5.5rem] flex-1">
          <button
            type="button"
            aria-current={status === video.status ? 'step' : undefined}
            onClick={() => void setVideoStatus(video, status)}
            className={cn(
              'flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium transition-colors',
              index <= current
                ? 'bg-accent-soft text-accent'
                : 'bg-surface-sunken text-fg-muted hover:text-fg',
              status === video.status && 'ring-2 ring-accent',
            )}
          >
            <span className="leading-tight">{VIDEO_STATUS_LABELS[status]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Details({ video }: { video: Video }) {
  const brand = useDataStore(selectBrand);
  const suggested = nextCta(brand.lastCta);
  return (
    <div className="grid gap-4 wide:grid-cols-2">
      <Input
        label={t.date}
        type="date"
        value={video.date}
        onChange={(event) => {
          if (event.target.value) void videosRepo.update(video.id, { date: event.target.value });
        }}
      />
      <Select
        label={t.hookType}
        options={hookOptions}
        value={video.hookType ?? NO_HOOK}
        onChange={(value) =>
          void videosRepo.update(video.id, { hookType: value === NO_HOOK ? undefined : value })
        }
      />
      <div className="wide:col-span-2">
        <Select
          label={t.cta}
          hint={video.cta === suggested ? t.ctaSuggested : undefined}
          options={ctaOptions}
          value={video.cta ?? suggested}
          onChange={(cta) => void setVideoCta(video, cta)}
          data-testid="video-cta"
        />
      </div>
      <div className="wide:col-span-2">
        <Textarea
          label={t.notes}
          rows={2}
          defaultValue={video.notes ?? ''}
          onBlur={(event) => {
            if (event.target.value !== (video.notes ?? ''))
              void videosRepo.update(video.id, { notes: event.target.value });
          }}
        />
      </div>
    </div>
  );
}

/** One video package with its building blocks. */
export function VideoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const video = useDataStore((s) => s.videos[id]);
  const aiEnabled = useSettings((s) => s.aiEnabled);
  const model = useSettings((s) => s.aiModel);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const back = (
    <IconButton icon={ArrowLeft} label={t.back} onClick={() => void navigate('/videos')} />
  );

  if (!video) {
    return (
      <Page title={de.videos.title} leading={back} width="narrow">
        <EmptyState title={t.notFound} />
      </Page>
    );
  }

  const blocks = blocksFor(video.kind);
  const ai = aiEnabled ? model : null;

  const generateAll = async () => {
    setBusy(true);
    try {
      for (const key of blocks) {
        setProgress(VIDEO_BLOCK_TEMPLATES[key].label);
        await generateBlock(videosRepo.get(video.id) ?? video, key, model);
      }
      toast.success(t.generatedAll);
    } catch (error: unknown) {
      const reason = error instanceof AiError ? error.reason : 'unknown';
      toast.error(de.settings.ai.errors[reason]);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Page
      title={video.topic}
      leading={back}
      width="narrow"
      actions={<IconButton icon={Trash2} label={t.delete} onClick={() => setDeleting(true)} />}
    >
      <div className="flex flex-col gap-5 pb-10">
        <p className="-mt-1 text-lg leading-snug font-semibold text-fg wide:hidden">
          {video.topic}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={VIDEO_STATUS_TONES[video.status]}>{VIDEO_STATUS_LABELS[video.status]}</Badge>
          <Badge>{VIDEO_KIND_LABELS[video.kind]}</Badge>
          <Badge>{formatDate(video.date)}</Badge>
          {video.series && <Badge>{video.series}</Badge>}
          {video.cta && <Badge tone="signal">CTA: {CTA_TEMPLATES[video.cta].label}</Badge>}
        </div>
        <Surface>
          <div className="flex flex-col gap-4">
            <StatusSteps video={video} />
            <Details video={video} />
            {video.statusHistory.length > 0 && (
              <details className="text-sm text-fg-secondary">
                <summary className="min-h-11 cursor-pointer content-center">{t.history}</summary>
                <ol className="flex flex-col gap-1 pb-1" data-testid="video-history">
                  {[...video.statusHistory].reverse().map((entry) => (
                    <li key={`${entry.at}-${entry.status}`}>
                      {timeFormat.format(new Date(entry.at))} · {VIDEO_STATUS_LABELS[entry.status]}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </Surface>

        {ai ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon={Sparkles}
              loading={busy && progress !== null}
              disabled={busy}
              onClick={() => void generateAll()}
            >
              {t.generateAll}
            </Button>
            {progress && (
              <span role="status" className="text-sm text-fg-secondary">
                {t.generating(progress)}
              </span>
            )}
          </div>
        ) : (
          <p className="px-1 text-sm text-fg-muted">{t.aiOff}</p>
        )}

        {blocks.map((key) => (
          <BlockCard key={key} video={video} blockKey={key} ai={ai} busy={busy} onBusy={setBusy} />
        ))}

        <CheckCard video={video} />
      </div>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await videosRepo.remove(video.id);
          toast.info(t.deleted(video.topic));
          void navigate('/videos');
        }}
        title={t.deleteTitle}
        message={t.deleteText}
        confirmLabel={t.delete}
      />
    </Page>
  );
}
