import { useEffect, useState } from 'react';
import { ExternalLink, LogIn, LogOut, PlugZap, Save } from 'lucide-react';
import { Badge, Button, Input, Toggle, toast } from '@/components/ui';
import { CLIENT_ID_PATTERN } from '@/core/google/oauth';
import { de } from '@/i18n/de';
import { cancelSignIn, signOut, useGoogleAuth, validToken } from '@/services/google/auth';
import { fetchChannel } from '@/services/youtube';
import { useSettings } from '@/features/settings/settingsStore';
import { authErrorText, finishRedirectSignIn, formatCount, startSignIn } from './googleSignIn';

const t = de.youtube;

/** YouTube connection: client id, sign-in (popup or redirect), connection test. */
export function YouTubeSettings() {
  const clientId = useSettings((s) => s.googleClientId);
  const set = useSettings((s) => s.set);
  const autoSync = useSettings((s) => s.youtubeAutoSync);
  const token = useGoogleAuth((s) => s.token);
  const pending = useGoogleAuth((s) => s.pending);
  const [draft, setDraft] = useState(clientId);
  const [error, setError] = useState<string | undefined>();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => finishRedirectSignIn(), []);

  const saveClientId = async () => {
    const value = draft.trim();
    if (value && !CLIENT_ID_PATTERN.test(value)) {
      setError(t.clientIdInvalid);
      return;
    }
    await set('googleClientId', value);
    signOut();
    toast.success(t.clientIdSaved);
  };

  const test = async () => {
    const current = validToken();
    if (!current) {
      signOut();
      setResult({ ok: false, text: t.errors.auth });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const channel = await fetchChannel(current.accessToken);
      setResult({
        ok: true,
        text: t.testOk(channel.title ?? channel.id, formatCount(channel.subscribers)),
      });
    } catch (caught: unknown) {
      setResult({ ok: false, text: authErrorText(caught) });
    } finally {
      setTesting(false);
    }
  };

  // An expired token fails with „Anmeldung abgelaufen“ and is dropped then.
  const signedIn = token !== null;
  const until = token
    ? new Date(token.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="flex flex-col gap-4" data-testid="youtube-settings">
      <p className="text-sm text-fg-secondary">{t.intro}</p>
      <div className="flex flex-col gap-2">
        <Input
          label={t.clientId}
          hint={t.clientIdHint}
          value={draft}
          error={error}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(undefined);
          }}
          data-testid="youtube-client-id"
        />
        {draft.trim() !== clientId && (
          <Button
            size="sm"
            variant="secondary"
            icon={Save}
            className="self-start"
            onClick={() => void saveClientId()}
            data-testid="youtube-client-id-save"
          >
            {t.clientIdSave}
          </Button>
        )}
      </div>
      <div className="h-px bg-line" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={signedIn ? 'success' : 'neutral'}>
          <span data-testid="youtube-state">{signedIn ? t.signedIn(until) : t.signedOut}</span>
        </Badge>
      </div>
      {pending ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-fg-secondary" role="status">
            {t.waiting}
          </p>
          <Button size="sm" variant="ghost" onClick={cancelSignIn}>
            {t.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {signedIn ? (
            <>
              <Button
                size="sm"
                icon={PlugZap}
                loading={testing}
                onClick={() => void test()}
                data-testid="youtube-test"
              >
                {t.test}
              </Button>
              <Button size="sm" variant="ghost" icon={LogOut} onClick={signOut}>
                {t.signOut}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                icon={LogIn}
                disabled={!clientId}
                onClick={() => void startSignIn('popup')}
                data-testid="youtube-sign-in"
              >
                {t.signIn}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={ExternalLink}
                disabled={!clientId}
                onClick={() => void startSignIn('redirect')}
                data-testid="youtube-sign-in-redirect"
              >
                {t.signInRedirect}
              </Button>
            </>
          )}
        </div>
      )}
      {!clientId && <p className="text-sm text-fg-muted">{t.noClientId}</p>}
      {!signedIn && clientId && <p className="text-sm text-fg-muted">{t.signInRedirectHint}</p>}
      {result && (
        <p
          role="status"
          className={result.ok ? 'text-sm text-success' : 'text-sm text-danger'}
          data-testid="youtube-test-result"
        >
          {result.text}
        </p>
      )}
      <p className="text-sm text-fg-muted">{t.tokenNote}</p>
      <div data-testid="youtube-auto">
        <Toggle
          label={t.sync.auto}
          description={t.sync.autoHint}
          checked={autoSync}
          onChange={(value) => void set('youtubeAutoSync', value)}
        />
      </div>
    </div>
  );
}
