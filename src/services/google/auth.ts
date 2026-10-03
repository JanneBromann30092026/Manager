/**
 * Google sign-in in the browser (no server, no client secret). The access token lives only in
 * memory, for one hour, and is dropped when the app locks. Two ways back from Google:
 * - popup: Google opens in a new window; oauth.html hands the token over a BroadcastChannel.
 * - redirect: the app itself goes to Google and comes back (reloads, unlock again); oauth.html
 *   leaves the result in sessionStorage for a moment, the app takes it out right after unlocking.
 */
import { create } from 'zustand';
import {
  buildAuthUrl,
  createState,
  missingScopes,
  modeOfState,
  parseAuthResponse,
  YOUTUBE_SCOPES,
  type AuthMode,
} from '@/core/google/oauth';
import { useVault } from '@/services/vault';

export const OAUTH_CHANNEL = 'manager.oauth';
const PENDING_STATE_KEY = 'manager.oauthState';
const RESULT_KEY = 'manager.oauthResult';
/** Renew a little before Google's expiry. */
const EXPIRY_MARGIN_MS = 60_000;

export interface GoogleToken {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export type AuthErrorReason =
  'noClientId' | 'denied' | 'scopes' | 'state' | 'timeout' | 'cancelled' | 'failed';

export class GoogleAuthError extends Error {
  constructor(readonly reason: AuthErrorReason) {
    super(`Google sign-in failed: ${reason}`);
    this.name = 'GoogleAuthError';
  }
}

interface GoogleAuthState {
  token: GoogleToken | null;
  /** A popup sign-in is waiting for Google. */
  pending: boolean;
}

export const useGoogleAuth = create<GoogleAuthState>(() => ({ token: null, pending: false }));

// Locking drops the token together with all decrypted data.
useVault.subscribe((state) => {
  if (state.status !== 'unlocked' && useGoogleAuth.getState().token)
    useGoogleAuth.setState({ token: null, pending: false });
});

export function validToken(now = Date.now()): GoogleToken | null {
  const { token } = useGoogleAuth.getState();
  return token && token.expiresAt - EXPIRY_MARGIN_MS > now ? token : null;
}

export function signOut(): void {
  useGoogleAuth.setState({ token: null, pending: false });
}

export function redirectUri(): string {
  return new URL(`${import.meta.env.BASE_URL}oauth.html`, window.location.origin).toString();
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function acceptFragment(fragment: string, expectedState: string): GoogleToken {
  const result = parseAuthResponse(fragment);
  if (result.state !== expectedState) throw new GoogleAuthError('state');
  if (!result.ok) throw new GoogleAuthError(result.error === 'access_denied' ? 'denied' : 'failed');
  if (missingScopes(result.scopes, YOUTUBE_SCOPES).length > 0) throw new GoogleAuthError('scopes');
  const token = {
    accessToken: result.accessToken,
    expiresAt: Date.now() + result.expiresIn * 1000,
    scopes: result.scopes,
  };
  useGoogleAuth.setState({ token, pending: false });
  return token;
}

let cancelPending: (() => void) | null = null;

/** Stops waiting for a popup sign-in. */
export function cancelSignIn(): void {
  cancelPending?.();
}

/**
 * Signs in. Popup: resolves with the token. Redirect: leaves the app (the promise never
 * resolves); the token is picked up by `takeRedirectResult` after the next unlock.
 */
export function signIn(
  clientId: string,
  mode: AuthMode,
  timeoutMs = 5 * 60_000,
): Promise<GoogleToken> {
  if (!clientId) return Promise.reject(new GoogleAuthError('noClientId'));
  cancelPending?.();
  const state = createState(mode, randomState());
  const url = buildAuthUrl({ clientId, redirectUri: redirectUri(), scopes: YOUTUBE_SCOPES, state });

  if (mode === 'redirect') {
    try {
      sessionStorage.setItem(PENDING_STATE_KEY, state);
    } catch {
      return Promise.reject(new GoogleAuthError('failed'));
    }
    window.location.assign(url);
    return new Promise(() => {});
  }

  return new Promise<GoogleToken>((resolve, reject) => {
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    const finish = () => {
      channel.close();
      window.removeEventListener('message', onWindowMessage);
      clearTimeout(timer);
      cancelPending = null;
      useGoogleAuth.setState({ pending: false });
    };
    const handle = (data: unknown) => {
      if (typeof data !== 'object' || data === null) return;
      const { type, fragment } = data as { type?: unknown; fragment?: unknown };
      if (type !== 'manager-oauth' || typeof fragment !== 'string') return;
      if (parseAuthResponse(fragment).state !== state) return;
      finish();
      try {
        resolve(acceptFragment(fragment, state));
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new GoogleAuthError('failed'));
      }
    };
    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) handle(event.data);
    };
    channel.onmessage = (event: MessageEvent) => handle(event.data);
    window.addEventListener('message', onWindowMessage);
    const timer = setTimeout(() => {
      finish();
      reject(new GoogleAuthError('timeout'));
    }, timeoutMs);
    cancelPending = () => {
      finish();
      reject(new GoogleAuthError('cancelled'));
    };
    useGoogleAuth.setState({ pending: true });
    const popup = window.open(url, 'manager-google', 'popup,width=520,height=680');
    if (!popup) {
      finish();
      reject(new GoogleAuthError('failed'));
    }
  });
}

/**
 * After a redirect sign-in: takes the result oauth.html left in sessionStorage (removes it at
 * once). Returns the token, null if there is none, or throws if it does not match.
 */
export function takeRedirectResult(): GoogleToken | null {
  let fragment: string | null;
  let expected: string | null;
  try {
    fragment = sessionStorage.getItem(RESULT_KEY);
    expected = sessionStorage.getItem(PENDING_STATE_KEY);
    sessionStorage.removeItem(RESULT_KEY);
    if (fragment) sessionStorage.removeItem(PENDING_STATE_KEY);
  } catch {
    return null;
  }
  if (!fragment) return null;
  const state = parseAuthResponse(fragment).state;
  if (!expected || !state || modeOfState(state) !== 'redirect') throw new GoogleAuthError('state');
  return acceptFragment(fragment, expected);
}
