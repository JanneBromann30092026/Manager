import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, ProgressBar } from '@/components/ui';
import { brandRepo } from '@/data/repositories';
import type { Brand } from '@/data/schemas';
import { CONVERSION_CHECKLIST } from '@/data/templates';
import { de } from '@/i18n/de';

const t = de.brand;

/** Conversion checklist (bio, highlights …) to tick off. */
export function ConversionSection({ brand }: { brand: Brand }) {
  const done = CONVERSION_CHECKLIST.filter((item) => brand.checklist[item.key]).length;
  const total = CONVERSION_CHECKLIST.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">{t.conversionHint}</p>
      <div className="flex flex-col gap-2">
        <ProgressBar value={done / total} label={t.conversionProgress(done, total)} />
        <span className="text-sm text-fg-secondary" data-testid="conversion-progress">
          {t.conversionProgress(done, total)}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {CONVERSION_CHECKLIST.map((item) => {
          const checked = brand.checklist[item.key] === true;
          return (
            <li key={item.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() =>
                  void brandRepo.update({
                    checklist: { ...brand.checklist, [item.key]: !checked },
                  })
                }
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent-soft"
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    checked ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
                  )}
                >
                  {checked && (
                    <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }}>
                      <Check size={16} strokeWidth={3} aria-hidden />
                    </motion.span>
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn('text-base text-fg', checked && 'text-fg-muted line-through')}
                  >
                    {item.label}
                  </span>
                  <span className="text-sm text-fg-muted">{item.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
