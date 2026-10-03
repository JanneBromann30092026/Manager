import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { de } from '@/i18n/de';
import { useInstagramToken } from '@/services/instagram';
import { instagramErrorText } from '@/features/connections/instagramTexts';
import { useSettings } from '@/features/settings/settingsStore';
import { syncInstagram, useInstagramSync } from './instagramSync';

const t = de.instagram.sync;

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** „Zahlen“: Instagram status (last fetch, automatic) and „Jetzt abrufen“. */
export function InstagramSyncBar() {
  const info = useInstagramToken((s) => s.info);
  const loaded = useInstagramToken((s) => s.loaded);
  const reload = useInstagramToken((s) => s.reload);
  const syncedAt = useSettings((s) => s.instagramSyncedAt);
  const auto = useSettings((s) => s.instagramAutoSync);
  const running = useInstagramSync((s) => s.running);
  const error = useInstagramSync((s) => s.error);
  const now = useMinuteClock();

  useEffect(() => {
    if (!loaded) reload();
  }, [loaded, reload]);

  if (!loaded) return null;

  if (!info) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-sunken px-4 py-2 text-sm text-fg-secondary"
        data-testid="instagram-sync"
      >
        <span>{t.noToken}</span>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center font-medium text-accent-fg"
        >
          {t.connect}
        </Link>
      </div>
    );
  }

  const last = Date.parse(syncedAt);
  const status = Number.isNaN(last)
    ? t.never
    : t.ago(Math.max(0, Math.floor((now - last) / 60_000)));

  const fetchNow = async () => {
    try {
      const done = await syncInstagram();
      if (done) toast.success(t.done(done.created, done.updated));
    } catch (caught: unknown) {
      toast.error(instagramErrorText(caught));
    }
  };

  return (
    <div
      className="flex flex-col gap-1 rounded-xl bg-surface-sunken px-4 py-2"
      data-testid="instagram-sync"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-secondary">
          <span className="font-medium text-fg">{t.status}</span> ·{' '}
          <span data-testid="instagram-sync-status">{status}</span>
          {auto && ` · ${t.autoOn}`}
        </p>
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          loading={running}
          onClick={() => void fetchNow()}
          data-testid="instagram-sync-now"
        >
          {running ? t.fetching : t.now}
        </Button>
      </div>
      {error !== null && !running && (
        <p role="alert" className="text-sm text-danger" data-testid="instagram-sync-error">
          {instagramErrorText(error)}
        </p>
      )}
    </div>
  );
}
