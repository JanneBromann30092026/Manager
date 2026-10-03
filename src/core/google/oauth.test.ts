import { describe, expect, it } from 'vitest';
import {
  buildAuthUrl,
  CLIENT_ID_PATTERN,
  createState,
  missingScopes,
  modeOfState,
  parseAuthResponse,
  YOUTUBE_SCOPES,
} from './oauth';

describe('google oauth', () => {
  it('builds the token-flow URL without a secret', () => {
    const url = new URL(
      buildAuthUrl({
        clientId: 'abc.apps.googleusercontent.com',
        redirectUri: 'https://example.github.io/Manager/oauth.html',
        scopes: YOUTUBE_SCOPES,
        state: 'popup.xyz',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('scope')).toBe(YOUTUBE_SCOPES.join(' '));
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://example.github.io/Manager/oauth.html',
    );
    expect(url.searchParams.has('client_secret')).toBe(false);
  });

  it('carries the mode in the state', () => {
    expect(modeOfState(createState('redirect', 'r1'))).toBe('redirect');
    expect(modeOfState('other.r1')).toBeUndefined();
  });

  it('parses tokens and errors from the fragment', () => {
    expect(
      parseAuthResponse(
        '#state=popup.1&access_token=ya29.x&token_type=Bearer&expires_in=3599&scope=a%20b',
      ),
    ).toEqual({
      ok: true,
      accessToken: 'ya29.x',
      expiresIn: 3599,
      scopes: ['a', 'b'],
      state: 'popup.1',
    });
    expect(parseAuthResponse('#error=access_denied&state=popup.1')).toEqual({
      ok: false,
      error: 'access_denied',
      state: 'popup.1',
    });
    expect(parseAuthResponse('')).toMatchObject({ ok: false, error: 'invalid_response' });
  });

  it('finds unticked scopes and checks client ids', () => {
    expect(missingScopes([YOUTUBE_SCOPES[0]], YOUTUBE_SCOPES)).toEqual([YOUTUBE_SCOPES[1]]);
    expect(CLIENT_ID_PATTERN.test('123-abc.apps.googleusercontent.com')).toBe(true);
    expect(CLIENT_ID_PATTERN.test('GOCSPX-secret')).toBe(false);
  });
});
