import type { ReactNode } from 'react';
import { Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui';
import { de } from '@/i18n/de';

const t = de.brand;

/** View/edit switch with "Bearbeiten" and "Speichern / Abbrechen". */
export function EditableCard({
  editing,
  onEdit,
  onCancel,
  onSave,
  view,
  form,
  testId,
}: {
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  view: ReactNode;
  form: ReactNode;
  testId: string;
}) {
  if (!editing) {
    return (
      <div className="flex flex-col gap-4" data-testid={testId}>
        {view}
        <div>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
            {t.edit}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      data-testid={`${testId}-form`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      {form}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" icon={Save}>
          {t.save}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
