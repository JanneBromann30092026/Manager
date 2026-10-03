import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { LogIn, RefreshCw } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { de } from '@/i18n/de';
import { useGoogleAuth } from '@/services/google/auth';
import { useInstagramToken } from '@/services/instagram';
import { authErrorText, startSignIn } from '@/features/connections/googleSignIn';
import { instagramErrorText } from '@/features/connections/instagramTexts';
import { useSettings } from '@/features/settings/settingsStore';
import { syncInstagram, useInstagramSync } from './instagramSync';
import { syncYouTube, useYouTubeSync } from './youtubeSync';

const ti = de.instagram.sync;
const ty = de.youtube.sync;

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function agoText(syncedAt: string, now: number): string {
  const last = Date.parse(syncedAt);
  return Number.isNaN(last) ? ti.never : ti.ago(Math.max(0, Math.floor((now - last) / 60_000)));
}

function Row({
  name,
  status,
  action,
  error,
  testId,
}: {
  name: string;
  status: string;
  action: ReactNode;
  error?: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-fg-secondary">
          <span className="font-medium text-fg">{name}</span> ·{' '}
          <span data-testid={`${testId}-status`}>{status}</span>
        </p>
        {action}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger" data-testid={`${testId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function InstagramRow({ now }: { now: number }) {
  const info = useInstagramToken((s) => s.info);
  const syncedAt = useSettings((s) => s.instagramSyncedAt);
  const auto = useSettings((s) => s.instagramAutoSync);
  const running = useInstagramSync((s) => s.running);
  const error = useInstagramSync((s) => s.error);

  if (!info) {
    return (
      <Row
        name={ti.status}
        status={ti.noToken}
        testId="instagram-sync"
        action={
          <Link
            to="/settings"
            className="inline-flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-accent-fg"
          >
            {ti.connect}
          </Link>
        }
      />
    );
  }

  const fetchNow = async () => {
    try {
      const done = await syncInstagram();
      if (done) toast.success(ti.done(done.created, done.updated));
    } catch (caught: unknown) {
      toast.error(instagramErrorText(caught));
    }
  };

  return (
    <Row
      name={ti.status}
      status={`${agoText(syncedAt, now)}${auto ? ` · ${ti.autoOn}` : ''}`}
      testId="instagram-sync"
      error={error !== null && !running ? instagramErrorText(error) : undefined}
      action={
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          loading={running}
          onClick={() => void fetchNow()}
          data-testid="instagram-sync-now"
        >
          <span className="max-[30rem]:sr-only">{running ? ti.fetching : ti.now}</span>
        </Button>
      }
    />
  );
}

function YouTubeRow({ now }: { now: number }) {
  const clientId = useSettings((s) => s.googleClientId);
  const syncedAt = useSettings((s) => s.youtubeSyncedAt);
  const auto = useSettings((s) => s.youtubeAutoSync);
  const token = useGoogleAuth((s) => s.token);
  const pending = useGoogleAuth((s) => s.pending);
  const running = useYouTubeSync((s) => s.running);
  const error = useYouTubeSync((s) => s.error);
  if (!clientId) return null;

  const fetchNow = async () => {
    try {
      const done = await syncYouTube();
      if (done) toast.success(ty.done(done.created, done.updated));
    } catch (caught: unknown) {
      toast.error(authErrorText(caught));
    }
  };

  const ago = agoText(syncedAt, now);
  return (
    <Row
      name={ty.status}
      status={token ? `${ago}${auto ? ` · ${ti.autoOn}` : ''}` : `${ago} · ${ty.signedOut}`}
      testId="youtube-sync"
      error={error !== null && !running && token ? authErrorText(error) : undefined}
      action={
        token ? (
          <Button
            size="sm"
            variant="ghost"
            icon={RefreshCw}
            loading={running}
            onClick={() => void fetchNow()}
            data-testid="youtube-sync-now"
          >
            <span className="max-[30rem]:sr-only">{running ? ti.fetching : ti.now}</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={LogIn}
            loading={pending}
            onClick={() => void startSignIn('popup')}
            data-testid="youtube-sync-sign-in"
          >
            <span className="max-[30rem]:sr-only">{ty.signIn}</span>
          </Button>
        )
      }
    />
  );
}

/** „Zahlen“: Instagram and YouTube status (last fetch, automatic) and „Jetzt abrufen“. */
export function SyncBar() {
  const loaded = useInstagramToken((s) => s.loaded);
  const reload = useInstagramToken((s) => s.reload);
  const now = useMinuteClock();

  useEffect(() => {
    if (!loaded) reload();
  }, [loaded, reload]);

  if (!loaded) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-sunken px-4 py-2">
      <InstagramRow now={now} />
      <YouTubeRow now={now} />
    </div>
  );
}
