import { useState } from 'react';
import { Button, Modal, Textarea, toast } from '@/components/ui';
import { looksPersonal, parseBulkIdeas } from '@/core/ideas';
import type { IdeaSource } from '@/data/domain';
import { ideasRepo } from '@/data/repositories';
import { de } from '@/i18n/de';
import { SourceChips } from './SourceChips';

const t = de.ideas;

function Form({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [source, setSource] = useState<IdeaSource>('community');
  const [busy, setBusy] = useState(false);
  const titles = parseBulkIdeas(text);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (titles.length === 0) return;
        setBusy(true);
        void ideasRepo
          .createMany(
            titles.map((title) => ({
              title,
              source,
              personal: source !== 'community' && looksPersonal(title),
            })),
          )
          .then((created) => {
            toast.success(t.createdMany(created.length));
            onClose();
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-sm text-fg-muted">{t.bulkForm.text}</p>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg-secondary">{t.form.source}</span>
        <SourceChips value={source} onChange={setSource} />
      </div>
      <Textarea
        label={t.bulkForm.field}
        placeholder={t.bulkForm.placeholder}
        rows={6}
        value={text}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        data-testid="bulk-text"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-fg-secondary" role="status" data-testid="bulk-preview">
          {t.bulkForm.preview(titles.length)}
        </span>
        <Button type="submit" loading={busy} disabled={titles.length === 0}>
          {t.bulkForm.submit}
        </Button>
      </div>
    </form>
  );
}

/** Paste several questions at once (one per line). */
export function BulkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={t.bulkForm.title} size="lg">
      {open && <Form onClose={onClose} />}
    </Modal>
  );
}
