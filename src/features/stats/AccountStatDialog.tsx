import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, IconButton, Input, Modal, Select, toast } from '@/components/ui';
import { parseNumber } from '@/core/csvImport';
import { localDateOf } from '@/core/dates';
import { PLATFORMS, type Platform } from '@/data/domain';
import { accountStatsRepo } from '@/data/repositories';
import { PLATFORM_LABELS } from '@/data/templates';
import { de } from '@/i18n/de';
import { formatDay, formatNumber, useAccountStats } from './statsData';

const t = de.stats.account;
const f = de.stats.form;

const OPTIONAL = [
  { key: 'views30d', max: 1_000_000_000 },
  { key: 'newFollowers30d', max: 1_000_000_000 },
  { key: 'views7d', max: 1_000_000_000 },
  { key: 'nonFollowerPct7d', max: 100 },
] as const;
type OptionalKey = (typeof OPTIONAL)[number]['key'];

function Form({ onClose }: { onClose: () => void }) {
  const history = useAccountStats();
  const [date, setDate] = useState(localDateOf());
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [followers, setFollowers] = useState('');
  const [values, setValues] = useState<Partial<Record<OptionalKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<OptionalKey | 'followers', string>>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next: typeof errors = {};
    const count = parseNumber(followers);
    if (count === undefined) next.followers = t.required;
    else if (count < 0) next.followers = f.invalid;
    const numbers: Partial<Record<OptionalKey, number>> = {};
    for (const { key, max } of OPTIONAL) {
      const raw = values[key]?.trim();
      if (!raw) continue;
      const value = parseNumber(raw);
      if (value === undefined) next[key] = f.invalid;
      else if (value < 0 || value > max) next[key] = f.tooHigh(max);
      else numbers[key] = key === 'nonFollowerPct7d' ? value : Math.round(value);
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || count === undefined) return;
    setBusy(true);
    try {
      await accountStatsRepo.create({ date, platform, followers: Math.round(count), ...numbers });
      toast.success(t.saved);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={t.date}
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Select
          label={f.platform}
          options={PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
          value={platform}
          onChange={setPlatform}
        />
        <Input
          label={t.followers}
          inputMode="numeric"
          value={followers}
          error={errors.followers}
          onChange={(event) => setFollowers(event.target.value)}
          data-testid="account-followers"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {OPTIONAL.map(({ key }) => (
          <Input
            key={key}
            label={t[key]}
            inputMode="decimal"
            value={values[key] ?? ''}
            error={errors[key]}
            onChange={(event) =>
              setValues((current) => ({ ...current, [key]: event.target.value }))
            }
          />
        ))}
      </div>
      <Button type="submit" loading={busy} className="self-start" data-testid="account-save">
        {t.save}
      </Button>
      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-sm font-semibold text-fg-secondary">{t.history}</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface-sunken">
            {history.map((stat) => (
              <li key={stat.id} className="flex min-h-12 items-center gap-3 px-4 py-1 text-sm">
                <span className="w-24 text-fg-secondary">{formatDay(stat.date)}</span>
                <span className="flex-1 font-medium text-fg">
                  {formatNumber(stat.followers)} · {PLATFORM_LABELS[stat.platform]}
                </span>
                <IconButton
                  icon={Trash2}
                  label={t.delete(formatDay(stat.date))}
                  onClick={() => void accountStatsRepo.remove(stat.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}

/** Follower count of a day (from the insights), with the history. */
export function AccountStatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={t.title} description={t.text} size="lg">
      {open && <Form onClose={onClose} />}
    </Modal>
  );
}
