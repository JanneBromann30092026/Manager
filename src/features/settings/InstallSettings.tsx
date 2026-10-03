import { useState } from 'react';
import { Badge } from '@/components/ui';
import { de } from '@/i18n/de';
import { isStandalone } from '@/services/displayMode';

const t = de.install;

/** How to install Manager as a home screen app (and whether it already runs as one). */
export function InstallSettings() {
  const [installed] = useState(isStandalone);
  return (
    <div className="flex flex-col gap-3" data-testid="install-settings">
      <div>
        <Badge tone={installed ? 'success' : 'neutral'}>
          <span data-testid="install-state">{installed ? t.installed : t.notInstalled}</span>
        </Badge>
      </div>
      <p className="text-sm text-fg-secondary">{t.intro}</p>
      {!installed && (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-fg">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      <p className="text-sm text-fg-muted">{t.note}</p>
    </div>
  );
}
