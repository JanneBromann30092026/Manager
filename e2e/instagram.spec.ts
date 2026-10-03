import { expect, test, type BrowserContext, type Route } from '@playwright/test';
import { nav, openApp } from './vault.ts';

/** Invented token – Instagram is always mocked, no real account. */
const TOKEN = `IGAAdemo${'x'.repeat(40)}`;
const REFRESHED = `IGAArefreshed${'y'.repeat(40)}`;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Invented demo account: one reel, one photo. */
async function mockInstagram(context: BrowserContext, options: { invalid?: boolean } = {}) {
  const calls: string[] = [];
  await context.route('https://graph.instagram.com/**', (route: Route) => {
    const url = new URL(route.request().url());
    calls.push(`${url.pathname}?token=${url.searchParams.get('access_token')?.slice(0, 13)}`);
    if (options.invalid)
      return json(
        route,
        { error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 } },
        400,
      );
    if (url.pathname === '/refresh_access_token')
      return json(route, { access_token: REFRESHED, token_type: 'bearer', expires_in: 5184000 });
    if (url.pathname.endsWith('/me'))
      return json(route, {
        user_id: '1784',
        username: 'demo.finanz',
        account_type: 'MEDIA_CREATOR',
        followers_count: 120,
      });
    if (url.pathname.endsWith('/me/media'))
      return json(route, {
        data: [
          {
            id: '9001',
            caption: 'Erfundenes Demo-Reel über Budgets #demo',
            media_type: 'VIDEO',
            media_product_type: 'REELS',
            timestamp: '2026-10-01T16:00:00+0000',
          },
          {
            id: '9002',
            media_type: 'IMAGE',
            media_product_type: 'FEED',
            timestamp: '2026-09-30T16:00:00+0000',
          },
        ],
      });
    if (url.pathname.endsWith('/9001/insights'))
      return json(route, {
        data: [
          { name: 'views', values: [{ value: 2400 }] },
          { name: 'likes', values: [{ value: 80 }] },
          { name: 'comments', values: [{ value: 6 }] },
          { name: 'shares', values: [{ value: 12 }] },
          { name: 'saved', values: [{ value: 30 }] },
          { name: 'ig_reels_avg_watch_time', values: [{ value: 7300 }] },
        ],
      });
    return json(route, { error: { code: 100 } }, 400);
  });
  return calls;
}

test('token is checked, stored encrypted, refreshed on fetch; reels land in „Zahlen“', async ({
  page,
  context,
}) => {
  const calls = await mockInstagram(context);
  await page.clock.setFixedTime(new Date('2026-10-03T10:00:00'));
  await openApp(page, '/settings');
  const section = page.getByTestId('instagram-settings');
  await expect(section.getByTestId('instagram-state')).toHaveText('Kein Token gespeichert');
  await page.getByTestId('instagram-token').fill('EAAB-facebook-token');
  await page.getByTestId('instagram-token-save').click();
  await expect(section.getByText('Das sieht nicht nach einem Instagram-Token aus')).toBeVisible();
  await page.getByTestId('instagram-token').fill(TOKEN);
  await page.getByTestId('instagram-token-save').click();
  await expect(section.getByTestId('instagram-state')).toHaveText('Verbunden mit @demo.finanz');
  await expect(section.getByTestId('instagram-days')).toHaveText('gilt noch 60 Tage');
  await expect(page.getByTestId('instagram-refresh')).toBeDisabled();
  // The token itself is never shown again.
  await expect(page.getByText(TOKEN)).toHaveCount(0);

  // Two days later: fetching refreshes the token first (Meta: older than 24 h).
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
  await nav(page).getByRole('link', { name: 'Zahlen' }).click();
  await page.getByTestId('stats-menu').click();
  await page.getByRole('menuitem', { name: 'Von Instagram abrufen' }).click();
  await page.getByTestId('instagram-fetch').click();
  await expect(page.getByTestId('instagram-profile')).toHaveText('@demo.finanz · 120 Follower');
  await expect(page.getByTestId('instagram-summary')).toHaveText('1 neu, 0 aktualisiert');
  await expect(page.getByText('1 Beitrag ist kein Reel')).toBeVisible();
  expect(calls[1]).toBe('/refresh_access_token?token=IGAAdemoxxxxx');
  expect(calls.slice(2).every((call) => call.endsWith('token=IGAArefreshed'))).toBe(true);
  await page.getByTestId('instagram-apply').click();

  const card = page.getByTestId('post-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Erfundenes Demo-Reel über Budgets');
  await expect(page.getByTestId('followers-card')).toContainText('120');
  await card.click();
  await expect(page.getByTestId('post-views')).toHaveValue('2400');
  await expect(page.getByTestId('post-saves')).toHaveValue('30');
  await expect(page.getByTestId('post-avgWatchSeconds')).toHaveValue('7,3');
  await expect(page.getByTestId('post-newFollowers')).toHaveValue('');
  await page.keyboard.press('Escape');

  // Reminder in the last week before expiry (refreshed on 05.10. → valid until 04.12., 4 days left).
  await page.clock.setFixedTime(new Date('2026-11-30T10:00:00'));
  await nav(page).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('instagram-reminder')).toContainText('in 4 Tagen ab');
});

test('an invalid token is reported and not stored', async ({ page, context }) => {
  await mockInstagram(context, { invalid: true });
  await openApp(page, '/settings');
  await page.getByTestId('instagram-token').fill(TOKEN);
  await page.getByTestId('instagram-token-save').click();
  await expect(page.getByText('Der Token ist ungültig oder abgelaufen.')).toBeVisible();
  await expect(page.getByTestId('instagram-state')).toHaveText('Kein Token gespeichert');
});
