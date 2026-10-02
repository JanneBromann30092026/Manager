import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge, Button, type BadgeTone } from '@/components/ui';
import { nextIdeaStatus } from '@/core/ideas';
import type { IdeaStatus } from '@/data/domain';
import { ideasRepo } from '@/data/repositories';
import type { Idea } from '@/data/schemas';
import { HOOK_TEMPLATES, IDEA_SOURCE_LABELS, IDEA_STATUS_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { toast } from '@/components/ui';

const t = de.ideas;

const STATUS_TONES: Record<IdeaStatus, BadgeTone> = {
  idea: 'neutral',
  planned: 'accent',
  filmed: 'warning',
  published: 'success',
};

/** One idea: title, badges, quick "next status". Tapping opens the editor. */
export function IdeaCard({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  const next = nextIdeaStatus(idea.status);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card"
      data-testid="idea-card"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 items-start gap-2 text-left"
        aria-label={`${idea.title} – ${de.brand.edit}`}
      >
        <span className="flex-1 text-base font-medium text-fg">{idea.title}</span>
        <ChevronRight size={18} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
      </button>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_TONES[idea.status]}>{IDEA_STATUS_LABELS[idea.status]}</Badge>
        <Badge tone={idea.source === 'community' ? 'signal' : 'neutral'}>
          {IDEA_SOURCE_LABELS[idea.source]}
        </Badge>
        {idea.personal && <Badge tone="accent">{t.personalBadge}</Badge>}
        {idea.series && <Badge>{idea.series}</Badge>}
        {idea.hookType && <Badge>{HOOK_TEMPLATES[idea.hookType].label}</Badge>}
        {next && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() =>
              void ideasRepo.update(idea.id, { status: next }).then(() => {
                toast.success(t.advanced(IDEA_STATUS_LABELS[next]));
              })
            }
          >
            {t.advance(IDEA_STATUS_LABELS[next])}
          </Button>
        )}
      </div>
    </motion.li>
  );
}
