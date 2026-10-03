import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, ChoiceChip, Input, Modal, Textarea, toast } from '@/components/ui';
import { nextCta } from '@/core/cta';
import { localDate } from '@/core/videos';
import { VIDEO_KINDS, type VideoKind } from '@/data/domain';
import { brandRepo } from '@/data/repositories';
import type { Idea } from '@/data/schemas';
import { CTA_TEMPLATES, VIDEO_KIND_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { createVideo } from './videoActions';

const t = de.videos.create;

function Form({ idea, onClose }: { idea?: Idea; onClose: () => void }) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState(idea?.title ?? '');
  const [date, setDate] = useState(localDate());
  const [kind, setKind] = useState<VideoKind>(idea?.source === 'podcast' ? 'podcast' : 'reel');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const cta = nextCta(brandRepo.get().lastCta);

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="video-create"
      onSubmit={(event) => {
        event.preventDefault();
        if (!topic.trim()) {
          setError(t.topicRequired);
          return;
        }
        setBusy(true);
        void createVideo({ topic, date, kind, ideaId: idea?.id })
          .then((video) => {
            toast.success(t.created);
            onClose();
            void navigate(`/videos/${video.id}`);
          })
          .finally(() => setBusy(false));
      }}
    >
      {idea && <p className="text-sm text-fg-secondary">{t.fromIdea(idea.title)}</p>}
      <Textarea
        label={t.topic}
        placeholder={t.topicPlaceholder}
        rows={2}
        value={topic}
        error={error}
        autoFocus={!idea}
        onChange={(event) => {
          setTopic(event.target.value);
          setError(undefined);
        }}
        data-testid="video-topic"
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg-secondary">{t.kind}</span>
        <div className="flex flex-wrap gap-2">
          {VIDEO_KINDS.map((value) => (
            <ChoiceChip key={value} selected={kind === value} onToggle={() => setKind(value)}>
              {VIDEO_KIND_LABELS[value]}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <Input
        label={t.date}
        hint={t.dateHint}
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value || localDate())}
      />
      <p className="text-sm text-fg-muted" data-testid="video-create-cta">
        {t.ctaHint(CTA_TEMPLATES[cta].label)}
      </p>
      <div>
        <Button type="submit" loading={busy}>
          {t.submit}
        </Button>
      </div>
    </form>
  );
}

export function CreateVideoDialog({
  open,
  idea,
  onClose,
}: {
  open: boolean;
  idea?: Idea;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t.title} size="lg">
      {open && <Form key={idea?.id ?? 'new'} idea={idea} onClose={onClose} />}
    </Modal>
  );
}
