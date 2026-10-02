import { useState } from 'react';
import { Textarea, toast } from '@/components/ui';
import { brandRepo } from '@/data/repositories';
import type { Brand } from '@/data/schemas';
import { de } from '@/i18n/de';
import { EditableCard } from './EditableCard';
import { lines } from './lines';

const t = de.brand;

/** Rules or growth priorities: numbered list, edited as one item per line. */
export function ListSection({
  brand,
  field,
  label,
  hint,
}: {
  brand: Brand;
  field: 'rules' | 'growth';
  label: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const items = brand[field];

  const save = async () => {
    if (draft === null) return;
    await brandRepo.update({ [field]: lines.split(draft) });
    setDraft(null);
    toast.success(t.saved);
  };

  return (
    <EditableCard
      testId={`brand-${field}`}
      editing={draft !== null}
      onEdit={() => setDraft(lines.join(items))}
      onCancel={() => setDraft(null)}
      onSave={() => void save()}
      view={
        <>
          {hint && <p className="text-sm text-fg-muted">{hint}</p>}
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-base text-fg marker:text-fg-muted">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </>
      }
      form={
        <Textarea
          label={label}
          hint={hint ? `${t.listHint} ${hint}` : t.listHint}
          rows={6}
          value={draft ?? ''}
          onChange={(event) => setDraft(event.target.value)}
        />
      }
    />
  );
}
