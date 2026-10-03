/**
 * Google sign-in without a server (OAuth 2.0 token flow for browser apps): the app opens
 * Google's consent page, Google sends the access token back to `oauth.html` in the URL
 * fragment. No client secret, no refresh token – the token lives one hour, in memory only.
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Read-only scopes: YouTube data (own videos) and YouTube Analytics. */
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const;

/** OAuth client id of the Manager project (public, may be in the code; never a secret). */
export const DEFAULT_GOOGLE_CLIENT_ID =
  '435425521293-m9kr2n2kdb4n88m7pkugdhd8nfdk26ro.apps.googleusercontent.com';

export const CLIENT_ID_PATTERN = /^[\w-]+\.apps\.googleusercontent\.com$/;

/** How the token comes back: popup window (app stays open) or redirect (app reloads). */
export type AuthMode = 'popup' | 'redirect';

export function buildAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'token',
    scope: options.scopes.join(' '),
    state: options.state,
    include_granted_scopes: 'true',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** State = mode + random value; oauth.html reads the mode to know how to hand the token back. */
export function createState(mode: AuthMode, random: string): string {
  return `${mode}.${random}`;
}

export function modeOfState(state: string): AuthMode | undefined {
  const mode = state.split('.')[0];
  return mode === 'popup' || mode === 'redirect' ? mode : undefined;
}

export type AuthResult =
  | { ok: true; accessToken: string; expiresIn: number; scopes: string[]; state: string }
  | { ok: false; error: string; state?: string };

/** Parses the URL fragment Google sends to the redirect URI. */
export function parseAuthResponse(fragment: string): AuthResult {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const state = params.get('state') ?? undefined;
  const error = params.get('error');
  if (error) return { ok: false, error, state };
  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in'));
  if (!accessToken || !state) return { ok: false, error: 'invalid_response', state };
  return {
    ok: true,
    accessToken,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
    scopes: (params.get('scope') ?? '').split(' ').filter(Boolean),
    state,
  };
}

/** Scopes the user did not grant (Google lets the user untick single scopes). */
export function missingScopes(granted: readonly string[], wanted: readonly string[]): string[] {
  return wanted.filter((scope) => !granted.includes(scope));
}
