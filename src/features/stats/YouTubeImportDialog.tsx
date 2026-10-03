import { useState } from 'react';
import { Link } from 'react-router';
import { Download, ExternalLink, LogIn } from 'lucide-react';
import { Button, Modal, toast } from '@/components/ui';
import { localDateOf } from '@/core/dates';
import { planYouTubeImport } from '@/core/youtube';
import { postsRepo } from '@/data/repositories';
import { de } from '@/i18n/de';
import { useGoogleAuth, validToken, signOut } from '@/services/google/auth';
import { fetchYouTube, YouTubeError, type YouTubeFetchResult } from '@/services/youtube';
import { useSettings } from '@/features/settings/settingsStore';
import { authErrorText, formatCount, startSignIn } from '@/features/connections/googleSignIn';
import { applyImport, saveFollowerCount } from './statsActions';

const t = de.youtube;
const ti = t.import;

function Content({ onClose }: { onClose: () => void }) {
  const clientId = useSettings((s) => s.googleClientId);
  const token = useGoogleAuth((s) => s.token);
  const pending = useGoogleAuth((s) => s.pending);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YouTubeFetchResult | null>(null);

  const signedIn = token !== null;
  const plans = result ? planYouTubeImport(postsRepo.list(), result.drafts) : [];
  const created = plans.filter((plan) => plan.kind === 'create').length;

  const fetchNow = async () => {
    const current = validToken();
    if (!current) {
      signOut();
      setError(t.errors.auth);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await fetchYouTube(current.accessToken));
    } catch (caught: unknown) {
      if (caught instanceof YouTubeError && caught.reason === 'auth') signOut();
      setError(authErrorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const done = await applyImport(plans, 'youtubeApi');
      if (result.channel.subscribers !== undefined)
        await saveFollowerCount('youtube', result.channel.subscribers, 'youtubeApi', localDateOf());
      toast.success(ti.done(done.created, done.updated));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!clientId) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-fg-secondary">{t.noClientId}</p>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center font-medium text-accent-fg"
        >
          {ti.toSettings}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="youtube-import">
      <p className="text-base text-fg-secondary">{ti.text}</p>
      {!signedIn ? (
        pending ? (
          <p className="text-sm text-fg-secondary" role="status">
            {t.waiting}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              icon={LogIn}
              onClick={() => void startSignIn('popup')}
              data-testid="youtube-import-sign-in"
            >
              {t.signIn}
            </Button>
            <Button
              variant="secondary"
              icon={ExternalLink}
              onClick={() => void startSignIn('redirect')}
            >
              {t.signInRedirect}
            </Button>
          </div>
        )
      ) : !result ? (
        <Button
          icon={Download}
          className="self-start"
          loading={busy}
          onClick={() => void fetchNow()}
          data-testid="youtube-fetch"
        >
          {busy ? ti.fetching : ti.fetch}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium text-fg" data-testid="youtube-channel">
            {ti.channel(
              result.channel.title ?? result.channel.id,
              formatCount(result.channel.subscribers),
            )}
          </p>
          {result.drafts.length === 0 ? (
            <p className="text-sm text-fg-secondary">{ti.none}</p>
          ) : (
            <p className="text-sm text-fg-secondary" data-testid="youtube-summary">
              {ti.summary(created, plans.length - created)}
            </p>
          )}
          {result.analyticsFailed && (
            <p
              className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-fg"
              data-testid="youtube-analytics-failed"
            >
              {ti.analyticsFailed}
            </p>
          )}
          <p className="text-sm text-fg-muted">{ti.lag}</p>
          <Button
            className="self-start"
            loading={busy}
            disabled={result.drafts.length === 0 && result.channel.subscribers === undefined}
            onClick={() => void apply()}
            data-testid="youtube-apply"
          >
            {ti.apply}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger" data-testid="youtube-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Reads the newest videos and their numbers from YouTube into „Zahlen“. */
export function YouTubeImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={ti.title}>
      {open && <Content onClose={onClose} />}
    </Modal>
  );
}
