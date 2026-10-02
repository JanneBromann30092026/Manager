import { useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, ConfirmDialog, Surface, toast } from '@/components/ui';
import { Page } from '@/app/shell/Page';
import { brandRepo, selectBrand } from '@/data/repositories';
import { useDataStore } from '@/data/store';
import { de } from '@/i18n/de';
import { BrandKitSection } from './BrandKitSection';
import { ChannelSection } from './ChannelSection';
import { ConversionSection } from './ConversionSection';
import { ListSection } from './ListSection';

const t = de.brand;

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h2 className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">{title}</h2>
      <Surface>{children}</Surface>
    </section>
  );
}

/** "Marke": conversion checklist, channel profile, brand kit, rules, growth priorities. */
export function BrandPage() {
  const brand = useDataStore(selectBrand);
  const stored = useDataStore((s) => Object.keys(s.brand).length > 0);
  const [resetting, setResetting] = useState(false);

  return (
    <Page
      title={t.title}
      width="narrow"
      actions={
        stored && (
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setResetting(true)}>
            {t.reset}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-8 pb-8">
        <Section title={t.sections.conversion} testId="brand-conversion">
          <ConversionSection brand={brand} />
        </Section>
        <Section title={t.sections.channel} testId="brand-channel-section">
          <ChannelSection brand={brand} />
        </Section>
        <Section title={t.sections.kit} testId="brand-kit">
          <BrandKitSection brand={brand} />
        </Section>
        <Section title={t.sections.rules} testId="brand-rules-section">
          <ListSection brand={brand} field="rules" label={t.sections.rules} hint={t.rulesHint} />
        </Section>
        <Section title={t.sections.growth} testId="brand-growth-section">
          <ListSection brand={brand} field="growth" label={t.sections.growth} />
        </Section>
      </div>
      <ConfirmDialog
        open={resetting}
        onClose={() => setResetting(false)}
        onConfirm={async () => {
          await brandRepo.reset();
          toast.info(t.resetDone);
        }}
        title={t.resetTitle}
        message={t.resetText}
        confirmLabel={t.reset}
      />
    </Page>
  );
}
