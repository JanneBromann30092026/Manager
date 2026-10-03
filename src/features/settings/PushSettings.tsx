import { useEffect, useState } from 'react';
import { Bell, BellOff, Copy, ExternalLink, Send } from 'lucide-react';
import { Badge, Button, ChoiceChip, ConfirmDialog, Select, Toggle, toast } from '@/components/ui';
import { PUSH_HOURS, PUSH_KINDS, WEEKDAYS, normalizeRule, type PushKind } from '@/core/push';
import { PUSH_GITHUB_LINKS } from '@/data/templates';
import { de } from '@/i18n/de';
import {
  buildPushConfig,
  disablePush,
  enablePush,
  PushError,
  pushFingerprint,
  showSample,
  usePushState,
} from '@/services/push';
import { copyText } from '@/services/share';
import { useSettings } from './settingsStore';

const t = de.push;

function errorText(error: unknown): string {
  return error instanceof PushError ? t.errors[error.reason] : t.errors.subscribe;
}

const hourOptions = PUSH_HOURS.map((hour) => ({ value: String(hour), label: t.hourOption(hour) }));

function RuleEditor({ kind }: { kind: PushKind }) {
  const schedule = useSettings((s) => s.pushSchedule);
  const set = useSettings((s) => s.set);
  const rule = schedule[kind];
  const update = (next: typeof rule) =>
    void set('pushSchedule', { ...schedule, [kind]: normalizeRule(next) });

  return (
    <div className="flex flex-col gap-2" data-testid={`push-rule-${kind}`}>
      <Toggle
        label={t.kinds[kind]}
        checked={rule.enabled}
        onChange={(enabled) => update({ ...rule, enabled })}
      />
      {rule.enabled && (
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.kinds[kind]}>
            {WEEKDAYS.map((day) => (
              <ChoiceChip
                key={day}
                selected={rule.weekdays.includes(day)}
                className="px-3"
                onToggle={() =>
                  update({
                    ...rule,
                    weekdays: rule.weekdays.includes(day)
                      ? rule.weekdays.filter((d) => d !== day)
                      : [...rule.weekdays, day],
                  })
                }
              >
                <span aria-hidden>{t.weekdays[day - 1]}</span>
                <span className="sr-only">{t.weekdayNames[day - 1]}</span>
              </ChoiceChip>
            ))}
          </div>
          {rule.weekdays.length === 0 && <p className="text-sm text-warning">{t.noDays}</p>}
          <div className="max-w-56">
            <Select
              label={t.hour}
              options={hourOptions}
              value={String(rule.hour)}
              onChange={(value) => update({ ...rule, hour: Number(value) })}
              data-testid={`push-hour-${kind}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Push reminders: permission and subscription on this device, schedule, GitHub secret. */
export function PushSettings() {
  const support = usePushState((s) => s.support);
  const permission = usePushState((s) => s.permission);
  const endpoint = usePushState((s) => s.endpoint);
  const loaded = usePushState((s) => s.loaded);
  const reload = usePushState((s) => s.reload);
  const schedule = useSettings((s) => s.pushSchedule);
  const copiedPrint = useSettings((s) => s.pushCopied);
  const set = useSettings((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) reload();
  }, [loaded, reload]);

  useEffect(() => {
    let cancelled = false;
    if (endpoint)
      void pushFingerprint(endpoint, schedule).then((print) => {
        if (!cancelled) setFingerprint(print);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, schedule]);

  if (!loaded) return <p className="text-sm text-fg-muted">{de.ui.loading}</p>;

  if (support !== 'supported') {
    return (
      <div className="flex flex-col gap-3" data-testid="push-settings">
        <p className="text-sm text-fg-secondary">{t.intro}</p>
        <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-fg" role="note">
          {support === 'needsHomeScreen' ? t.needsHomeScreen : t.unsupported}
        </p>
      </div>
    );
  }

  const on = endpoint !== null && permission === 'granted';
  const setupState = !copiedPrint
    ? 'missing'
    : endpoint && fingerprint === copiedPrint
      ? 'current'
      : 'outdated';

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await action();
      if (done) toast.success(done);
    } catch (error: unknown) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const copySetup = () =>
    run(async () => {
      const text = await buildPushConfig(schedule);
      if (!(await copyText(text))) {
        toast.error(t.copyFailed);
        return;
      }
      if (endpoint) await set('pushCopied', await pushFingerprint(endpoint, schedule));
      toast.success(t.copied);
    });

  return (
    <div className="flex flex-col gap-4" data-testid="push-settings">
      <p className="text-sm text-fg-secondary">{t.intro}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={on ? 'success' : permission === 'denied' ? 'danger' : 'neutral'}>
          <span data-testid="push-state">
            {on ? t.stateOn : permission === 'denied' ? t.stateDenied : t.stateOff}
          </span>
        </Badge>
      </div>
      {permission === 'denied' && <p className="text-sm text-fg-secondary">{t.deniedHint}</p>}

      {!on && permission !== 'denied' && (
        <Button
          icon={Bell}
          className="self-start"
          loading={busy}
          onClick={() => void run(enablePush, t.enabled)}
          data-testid="push-enable"
        >
          {t.enable}
        </Button>
      )}

      {on && (
        <>
          <div className="h-px bg-line" />
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-fg">{t.schedule}</h3>
            <p className="text-sm text-fg-muted">{t.scheduleHint}</p>
          </div>
          <div className="flex flex-col gap-1">
            {PUSH_KINDS.map((kind) => (
              <RuleEditor key={kind} kind={kind} />
            ))}
          </div>

          <div className="h-px bg-line" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-fg">{t.setup}</h3>
            <Badge
              tone={
                setupState === 'current'
                  ? 'success'
                  : setupState === 'outdated'
                    ? 'warning'
                    : 'neutral'
              }
            >
              <span data-testid="push-setup-state">
                {setupState === 'current'
                  ? t.setupCurrent
                  : setupState === 'outdated'
                    ? t.setupOutdated
                    : t.setupMissing}
              </span>
            </Badge>
          </div>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-fg-secondary">
            {t.setupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={Copy}
              loading={busy}
              onClick={() => void copySetup()}
              data-testid="push-copy"
            >
              {t.copy}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={ExternalLink}
              onClick={() =>
                window.open(
                  copiedPrint ? PUSH_GITHUB_LINKS.secrets : PUSH_GITHUB_LINKS.newSecret,
                  '_blank',
                  'noopener',
                )
              }
            >
              {t.openGithub}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Send}
              onClick={() => window.open(PUSH_GITHUB_LINKS.workflow, '_blank', 'noopener')}
            >
              {t.testGithub}
            </Button>
          </div>
          <p className="text-sm text-fg-muted">{t.copyHint}</p>
          <p className="text-sm text-fg-muted">{t.changedHint}</p>

          <div className="h-px bg-line" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Bell}
              onClick={() => void run(showSample, t.sampleShown)}
              data-testid="push-sample"
            >
              {t.sample}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={BellOff}
              onClick={() => setDisabling(true)}
              data-testid="push-disable"
            >
              {t.disable}
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={disabling}
        onClose={() => setDisabling(false)}
        onConfirm={async () => {
          await disablePush();
          await set('pushCopied', '');
          setDisabling(false);
          toast.info(t.disabled);
        }}
        title={t.disableTitle}
        message={t.disableText}
        confirmLabel={t.disable}
      />
    </div>
  );
}
