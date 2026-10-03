import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { nav, openApp, unlock } from './vault.ts';

/** Invented OAuth client id – Google is always mocked, no real account. */
const CLIENT_ID = '123456-e2etest.apps.googleusercontent.com';
const SCOPES =
  'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

/** Google's consent page answers at once with a redirect to oauth.html (token in the fragment). */
async function mockGoogleSignIn(context: BrowserContext, scopes = SCOPES) {
  await context.route('https://accounts.google.com/**', (route: Route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('response_type')).toBe('token');
    const fragment = new URLSearchParams({
      access_token: 'ya29.e2e-test-token',
      token_type: 'Bearer',
      expires_in: '3599',
      scope: scopes,
      state: url.searchParams.get('state') ?? '',
    });
    return route.fulfill({
      status: 302,
      headers: { location: `${url.searchParams.get('redirect_uri')}#${fragment.toString()}` },
    });
  });
}

/** Invented demo channel with two videos. */
async function mockYouTube(context: BrowserContext, analytics: 'ok' | 'off' = 'ok') {
  const tokens: string[] = [];
  await context.route('https://www.googleapis.com/youtube/v3/**', (route: Route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    tokens.push(route.request().headers().authorization ?? '');
    const url = new URL(route.request().url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    if (url.pathname.endsWith('/channels'))
      return json({
        items: [
          {
            id: 'UC-demo',
            snippet: { title: 'Demo-Kanal' },
            statistics: { subscriberCount: '42' },
            contentDetails: { relatedPlaylists: { uploads: 'UU-demo' } },
          },
        ],
      });
    if (url.pathname.endsWith('/playlistItems'))
      return json({
        items: [{ contentDetails: { videoId: 'vid1' } }, { contentDetails: { videoId: 'vid2' } }],
      });
    return json({
      items: [
        {
          id: 'vid1',
          snippet: { title: 'Erfundenes Demo-Video', publishedAt: '2026-09-29T15:00:00Z' },
          contentDetails: { duration: 'PT10M' },
          statistics: { viewCount: '800', likeCount: '20', commentCount: '3' },
        },
        {
          id: 'vid2',
          snippet: { title: 'Erfundener Demo-Short', publishedAt: '2026-10-01T15:00:00Z' },
          contentDetails: { duration: 'PT45S' },
          statistics: { viewCount: '1500', likeCount: '60', commentCount: '5' },
        },
      ],
    });
  });
  await context.route('https://youtubeanalytics.googleapis.com/**', (route: Route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    if (analytics === 'off')
      return route.fulfill({
        status: 403,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({ error: { errors: [{ reason: 'accessNotConfigured' }] } }),
      });
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({
        columnHeaders: [
          { name: 'video' },
          { name: 'averageViewDuration' },
          { name: 'subscribersGained' },
        ],
        rows: [
          ['vid1', 140, 4],
          ['vid2', 31, 2],
        ],
      }),
    });
  });
  return tokens;
}

async function saveClientId(page: Page) {
  const section = page.getByTestId('youtube-settings');
  await expect(page.getByTestId('youtube-client-id')).toHaveValue(
    /\.apps\.googleusercontent\.com$/,
  );
  await page.getByTestId('youtube-client-id').fill('GOCSPX-das-ist-ein-secret');
  await page.getByTestId('youtube-client-id-save').click();
  await expect(section.getByText('Das ist keine Client-ID')).toBeVisible();
  await page.getByTestId('youtube-client-id').fill(CLIENT_ID);
  await page.getByTestId('youtube-client-id-save').click();
  await expect(page.getByText('Client-ID gespeichert.')).toBeVisible();
}

/** Manual import tests: switch off the automatic fetch after signing in. */
async function manualOnly(page: Page) {
  await page.getByTestId('youtube-auto').getByRole('switch').click();
  await expect(page.getByTestId('youtube-auto').getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'false',
  );
}

test('sign in with a popup, test the connection, import videos into „Zahlen“', async ({
  page,
  context,
}) => {
  await mockGoogleSignIn(context);
  const tokens = await mockYouTube(context);
  await openApp(page, '/settings');
  await saveClientId(page);
  await manualOnly(page);

  const popup = page.waitForEvent('popup');
  await page.getByTestId('youtube-sign-in').click();
  await (await popup).waitForEvent('close');
  await expect(page.getByTestId('youtube-state')).toContainText('Angemeldet bis');
  await page.getByTestId('youtube-test').click();
  await expect(page.getByTestId('youtube-test-result')).toHaveText(
    'Verbunden mit „Demo-Kanal“ · 42 Abonnenten',
  );
  expect(tokens.every((value) => value === 'Bearer ya29.e2e-test-token')).toBe(true);

  await nav(page).getByRole('link', { name: 'Zahlen' }).click();
  await page.getByTestId('stats-menu').click();
  await page.getByRole('menuitem', { name: 'Von YouTube abrufen' }).click();
  await page.getByTestId('youtube-fetch').click();
  await expect(page.getByTestId('youtube-channel')).toHaveText('Demo-Kanal · 42 Abonnenten');
  await expect(page.getByTestId('youtube-summary')).toHaveText('2 neu, 0 aktualisiert');
  await page.getByTestId('youtube-apply').click();
  await expect(page.getByTestId('post-card')).toHaveCount(2);
  const short = page.getByTestId('post-card').filter({ hasText: 'Demo-Short' });
  await expect(short).toContainText('Short');
  await expect(short.getByTestId('post-rate')).toContainText('1,3');

  // Second import updates the same posts (matched by the YouTube id).
  await page.getByTestId('stats-menu').click();
  await page.getByRole('menuitem', { name: 'Von YouTube abrufen' }).click();
  await page.getByTestId('youtube-fetch').click();
  await expect(page.getByTestId('youtube-summary')).toHaveText('0 neu, 2 aktualisiert');
  await page.getByTestId('youtube-apply').click();
  await expect(page.getByTestId('post-card')).toHaveCount(2);
  await short.click();
  await expect(page.getByTestId('post-avgWatchSeconds')).toHaveValue('31');
  await expect(page.getByTestId('post-newFollowers')).toHaveValue('2');
});

test('redirect sign-in comes back after unlocking; missing analytics stay empty', async ({
  page,
  context,
}) => {
  await mockGoogleSignIn(context);
  await mockYouTube(context, 'off');
  await openApp(page, '/settings');
  await saveClientId(page);
  await manualOnly(page);
  await page.getByTestId('youtube-sign-in-redirect').click();
  await unlock(page);
  await expect(page.getByTestId('youtube-state')).toContainText('Angemeldet bis');
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);

  await nav(page).getByRole('link', { name: 'Zahlen' }).click();
  await page.getByTestId('stats-menu').click();
  await page.getByRole('menuitem', { name: 'Von YouTube abrufen' }).click();
  await page.getByTestId('youtube-fetch').click();
  await expect(page.getByTestId('youtube-analytics-failed')).toBeVisible();
  await page.getByTestId('youtube-apply').click();
  await page.getByTestId('post-card').filter({ hasText: 'Demo-Video' }).click();
  await expect(page.getByTestId('post-views')).toHaveValue('800');
  await expect(page.getByTestId('post-newFollowers')).toHaveValue('');
});

test('unticked analytics scope is reported', async ({ page, context }) => {
  await mockGoogleSignIn(context, 'https://www.googleapis.com/auth/youtube.readonly');
  await openApp(page, '/settings');
  await saveClientId(page);
  const popup = page.waitForEvent('popup');
  await page.getByTestId('youtube-sign-in').click();
  await (await popup).waitForEvent('close');
  await expect(page.getByText('Bitte beide Zugriffe erlauben')).toBeVisible();
  await expect(page.getByTestId('youtube-state')).toHaveText('Nicht angemeldet');
});

test('fetches automatically after signing in; an edited topic survives the next fetch', async ({
  page,
  context,
}) => {
  await mockGoogleSignIn(context);
  await mockYouTube(context);
  await openApp(page, '/settings');
  await saveClientId(page);
  await nav(page).getByRole('link', { name: 'Zahlen' }).click();
  await expect(page.getByTestId('youtube-sync-status')).toContainText('nicht angemeldet');
  const popup = page.waitForEvent('popup');
  await page.getByTestId('youtube-sync-sign-in').click();
  await (await popup).waitForEvent('close');
  await expect(page.getByText('YouTube: 2 neue Videos übernommen.')).toBeVisible();
  await expect(page.getByTestId('youtube-sync-status')).toContainText('gerade eben abgerufen');
  await expect(page.getByTestId('post-card')).toHaveCount(2);

  await page.getByTestId('post-card').filter({ hasText: 'Demo-Short' }).click();
  await expect(page.getByTestId('post-history')).toContainText('1 Abruf');
  await page.getByTestId('post-topic').fill('Mein eigener Titel');
  await page.getByTestId('post-save').click();
  await expect(page.getByTestId('post-form')).toHaveCount(0);

  await page.getByTestId('youtube-sync-now').click();
  await expect(page.getByText('YouTube abgerufen: 0 neu, 2 aktualisiert.')).toBeVisible();
  await expect(page.getByTestId('post-card').filter({ hasText: 'Mein eigener Titel' })).toHaveCount(
    1,
  );
});
