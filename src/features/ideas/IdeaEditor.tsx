import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Clapperboard, Trash2 } from 'lucide-react';
import {
  Button,
  ChoiceChip,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Textarea,
  Toggle,
  toast,
} from '@/components/ui';
import { looksPersonal } from '@/core/ideas';
import { HOOK_TYPES, IDEA_STATUSES, type HookType } from '@/data/domain';
import { ideasRepo } from '@/data/repositories';
import type { Idea, IdeaInput } from '@/data/schemas';
import { HOOK_TEMPLATES, IDEA_STATUS_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { SourceChips } from './SourceChips';

const t = de.ideas;
const f = t.form;

const statusOptions = IDEA_STATUSES.map((value) => ({ value, label: IDEA_STATUS_LABELS[value] }));
const NO_HOOK = 'none' as const;
const hookOptions: { value: HookType | typeof NO_HOOK; label: string }[] = [
  { value: NO_HOOK, label: f.hookNone },
  ...HOOK_TYPES.map((value) => ({ value, label: HOOK_TEMPLATES[value].label })),
];

type Draft = Required<Pick<IdeaInput, 'title' | 'source' | 'personal' | 'status'>> & {
  series: string;
  hookType: HookType | typeof NO_HOOK;
  notes: string;
};

function toDraft(idea: Idea | undefined): Draft {
  return {
    title: idea?.title ?? '',
    source: idea?.source ?? 'own',
    personal: idea?.personal ?? false,
    status: idea?.status ?? 'idea',
    series: idea?.series ?? '',
    hookType: idea?.hookType ?? NO_HOOK,
    notes: idea?.notes ?? '',
  };
}

function Form({
  idea,
  seriesSuggestions,
  onClose,
}: {
  idea: Idea | undefined;
  seriesSuggestions: readonly string[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => toDraft(idea));
  const [personalTouched, setPersonalTouched] = useState(idea !== undefined);
  const [error, setError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  const input = (): IdeaInput => ({
    title: draft.title,
    source: draft.source,
    personal: draft.personal,
    status: draft.status,
    series: draft.series,
    hookType: draft.hookType === NO_HOOK ? undefined : draft.hookType,
    notes: draft.notes,
  });

  const save = async (overrides: Partial<IdeaInput> = {}) => {
    if (!draft.title.trim()) {
      setError(f.titleRequired);
      return false;
    }
    setBusy(true);
    try {
      if (idea) await ideasRepo.update(idea.id, { ...input(), ...overrides });
      else await ideasRepo.create({ ...input(), ...overrides });
      return true;
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="idea-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save().then((ok) => {
          if (!ok) return;
          toast.success(idea ? t.saved : t.created);
          onClose();
        });
      }}
    >
      <Textarea
        label={f.title}
        placeholder={f.titlePlaceholder}
        rows={2}
        value={draft.title}
        error={error}
        autoFocus={!idea}
        onChange={(event) => {
          const title = event.target.value;
          setError(undefined);
          patch(
            personalTouched
              ? { title }
              : { title, personal: draft.source !== 'community' && looksPersonal(title) },
          );
        }}
        data-testid="idea-title"
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg-secondary">{f.source}</span>
        <SourceChips
          value={draft.source}
          onChange={(source) =>
            patch(
              personalTouched
                ? { source }
                : { source, personal: source !== 'community' && looksPersonal(draft.title) },
            )
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        <Input
          label={f.series}
          hint={f.seriesHint}
          placeholder={f.seriesPlaceholder}
          value={draft.series}
          onChange={(event) => patch({ series: event.target.value })}
          data-testid="idea-series"
        />
        <div className="flex flex-wrap gap-2">
          {seriesSuggestions.map((series) => (
            <ChoiceChip
              key={series}
              selected={draft.series === series}
              onToggle={() => patch({ series: draft.series === series ? '' : series })}
            >
              {series}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <Select
        label={f.hookType}
        options={hookOptions}
        value={draft.hookType}
        onChange={(hookType) => patch({ hookType })}
      />
      <Toggle
        label={f.personal}
        description={f.personalHint}
        checked={draft.personal}
        onChange={(personal) => {
          setPersonalTouched(true);
          patch({ personal });
        }}
      />
      <Textarea
        label={f.notes}
        rows={2}
        value={draft.notes}
        onChange={(event) => patch({ notes: event.target.value })}
      />
      {idea && (
        <Select
          label={f.status}
          options={statusOptions}
          value={draft.status}
          onChange={(status) => patch({ status })}
          data-testid="idea-status"
        />
      )}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="submit" loading={busy} data-testid="idea-save">
          {idea ? f.save : f.create}
        </Button>
        {idea && (draft.status === 'idea' || draft.status === 'planned') && (
          <Button
            type="button"
            variant="secondary"
            icon={Clapperboard}
            onClick={() =>
              void save({ status: 'planned' }).then((ok) => {
                if (!ok) return;
                toast.info(t.planned);
                onClose();
                void navigate('/videos');
              })
            }
          >
            {f.startVideo}
          </Button>
        )}
        {idea && (
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
      {idea && (draft.status === 'idea' || draft.status === 'planned') && (
        <p className="text-sm text-fg-muted">{f.startVideoHint}</p>
      )}
      {idea && (
        <ConfirmDialog
          open={deleting}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await ideasRepo.remove(idea.id);
            toast.info(t.deleted(idea.title));
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

/** Create or edit one idea. */
export function IdeaEditor({
  open,
  idea,
  seriesSuggestions,
  onClose,
}: {
  open: boolean;
  idea: Idea | undefined;
  seriesSuggestions: readonly string[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={idea ? f.editTitle : f.newTitle} size="lg">
      {open && (
        <Form
          key={idea?.id ?? 'new'}
          idea={idea}
          seriesSuggestions={seriesSuggestions}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
