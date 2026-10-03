import { useEffect, useState } from 'react';
import { RefreshCw, Save, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, PasswordInput, toast } from '@/components/ui';
import { cleanToken, tokenStatus } from '@/core/instagram';
import { de } from '@/i18n/de';
import { instagramErrorText } from './instagramTexts';
import {
  loadToken,
  refreshToken,
  removeToken,
  saveToken,
  useInstagramToken,
} from '@/services/instagram';

const t = de.instagram;

/** Instagram: long-lived token (encrypted), status, refresh, how-to. */
export function InstagramSettings() {
  const info = useInstagramToken((s) => s.info);
  const loaded = useInstagramToken((s) => s.loaded);
  const reload = useInstagramToken((s) => s.reload);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!loaded) reload();
  }, [loaded, reload]);

  const save = async () => {
    const token = cleanToken(draft);
    if (!token) {
      setError(t.tokenInvalid);
      return;
    }
    setBusy(true);
    try {
      const profile = await saveToken(token);
      setDraft('');
      setReplacing(false);
      toast.success(t.saved(profile.username ?? '–'));
    } catch (caught: unknown) {
      setError(instagramErrorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const record = await loadToken();
      if (!record) return;
      await refreshToken(record);
      toast.success(t.refreshed);
    } catch (caught: unknown) {
      toast.error(instagramErrorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const status = info ? tokenStatus(info, now) : null;

  return (
    <div className="flex flex-col gap-4" data-testid="instagram-settings">
      <p className="text-sm text-fg-secondary">{t.intro}</p>
      <div className="flex flex-wrap items-center gap-2">
        {info && status ? (
          <>
            <Badge tone={status.expired ? 'danger' : status.warn ? 'warning' : 'success'}>
              <span data-testid="instagram-state">{t.stored(info.username ?? '')}</span>
            </Badge>
            <span className="text-sm text-fg-secondary" data-testid="instagram-days">
              {status.expired ? t.expired : t.daysLeft(status.daysLeft)}
            </span>
          </>
        ) : (
          <Badge>
            <span data-testid="instagram-state">{t.none}</span>
          </Badge>
        )}
      </div>
      {(!info || replacing) && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <PasswordInput
            label={t.token}
            hint={t.tokenHint}
            value={draft}
            error={error}
            autoComplete="new-password"
            onChange={(event) => {
              setDraft(event.target.value);
              setError(undefined);
            }}
            data-testid="instagram-token"
          />
          <Button
            type="submit"
            size="sm"
            icon={Save}
            className="self-start"
            loading={busy}
            disabled={!draft.trim()}
            data-testid="instagram-token-save"
          >
            {t.save}
          </Button>
        </form>
      )}
      {info && status && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            loading={busy}
            disabled={!status.canRefresh}
            onClick={() => void refresh()}
            data-testid="instagram-refresh"
          >
            {t.refresh}
          </Button>
          {!replacing && (
            <Button size="sm" variant="ghost" onClick={() => setReplacing(true)}>
              {t.replace}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRemoving(true)}>
            {t.remove}
          </Button>
        </div>
      )}
      {info && <p className="text-sm text-fg-muted">{t.refreshHint}</p>}
      <details className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-fg-secondary">
        <summary className="min-h-11 cursor-pointer content-center font-medium text-fg">
          {t.howTo}
        </summary>
        <ol className="flex list-decimal flex-col gap-1.5 pt-2 pl-5">
          {t.howToSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
      <ConfirmDialog
        open={removing}
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await removeToken();
          setRemoving(false);
          toast.info(t.removed);
        }}
        title={t.remove}
        confirmLabel={t.remove}
      />
    </div>
  );
}

/** Reminder banner when the token expires within a week (start page, numbers). */
export function InstagramTokenReminder() {
  const info = useInstagramToken((s) => s.info);
  const loaded = useInstagramToken((s) => s.loaded);
  const reload = useInstagramToken((s) => s.reload);
  const [now] = useState(() => new Date());
  useEffect(() => {
    if (!loaded) reload();
  }, [loaded, reload]);
  if (!info) return null;
  const status = tokenStatus(info, now);
  if (!status.warn) return null;
  return (
    <p
      role="status"
      className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-fg wide:col-span-2"
      data-testid="instagram-reminder"
    >
      {status.expired ? t.expiredBanner : t.expiresSoon(status.daysLeft)}
    </p>
  );
}
