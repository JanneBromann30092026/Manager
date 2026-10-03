import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, Lightbulb, Plus } from 'lucide-react';
import { Badge, Button, EmptyState } from '@/components/ui';
import { Page } from '@/app/shell/Page';
import { nextCta } from '@/core/cta';
import { selectBrand } from '@/data/repositories';
import type { Video } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { CTA_TEMPLATES, VIDEO_KIND_LABELS, VIDEO_STATUS_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { CreateVideoDialog } from './CreateVideoDialog';
import { formatDate, VIDEO_STATUS_TONES } from './videoFormat';

const t = de.videos;

function VideoRow({ video }: { video: Video }) {
  return (
    <li>
      <Link
        to={`/videos/${video.id}`}
        className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-surface-raised"
        data-testid="video-card"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-base font-medium text-fg">{video.topic}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
            <span>{formatDate(video.date)}</span>
            <Badge tone={VIDEO_STATUS_TONES[video.status]}>
              {VIDEO_STATUS_LABELS[video.status]}
            </Badge>
            <Badge>{VIDEO_KIND_LABELS[video.kind]}</Badge>
            {video.series && <Badge>{video.series}</Badge>}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-fg-muted" aria-hidden />
      </Link>
    </li>
  );
}

function Group({ title, videos }: { title: string; videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">{title}</h2>
      <ul className="flex flex-col gap-3">
        {videos.map((video) => (
          <VideoRow key={video.id} video={video} />
        ))}
      </ul>
    </section>
  );
}

/** All video packages: open ones by date, published ones newest first. */
export function VideosPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const videosMap = useDataStore((s) => s.videos);
  const ideas = useDataStore((s) => s.ideas);
  const brand = useDataStore(selectBrand);
  const [creating, setCreating] = useState(false);
  const ideaId = params.get('idea');
  const idea = ideaId ? ideas[ideaId] : undefined;

  const { open, done } = useMemo(() => {
    const all = Object.values(videosMap);
    return {
      open: all
        .filter((v) => v.status !== 'published')
        .sort((a, b) => a.date.localeCompare(b.date)),
      done: all
        .filter((v) => v.status === 'published')
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [videosMap]);

  const closeCreate = () => {
    setCreating(false);
    if (ideaId) setParams({}, { replace: true });
  };

  const total = open.length + done.length;
  return (
    <Page
      title={t.title}
      actions={
        <Button size="sm" icon={Plus} onClick={() => setCreating(true)} data-testid="video-add">
          <span className="max-[30rem]:sr-only">{t.add}</span>
        </Button>
      }
    >
      {total === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          text={t.emptyText}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={Plus} onClick={() => setCreating(true)}>
                {t.add}
              </Button>
              <Button variant="secondary" icon={Lightbulb} onClick={() => void navigate('/ideas')}>
                {t.fromIdeas}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-6 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-sm font-medium text-fg-secondary">{t.count(total)}</span>
            <Badge tone="signal">
              <span data-testid="next-cta">
                {t.nextCta(CTA_TEMPLATES[nextCta(brand.lastCta)].label)}
              </span>
            </Badge>
          </div>
          <Group title={t.open} videos={open} />
          <Group title={t.done} videos={done} />
        </div>
      )}
      <CreateVideoDialog open={creating || idea !== undefined} idea={idea} onClose={closeCreate} />
    </Page>
  );
}
