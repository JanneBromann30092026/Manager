import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { DEMO_PUSH_ENDPOINT, installPushMock } from './pushMock.ts';
import { openApp } from './vault.ts';

const ENDPOINT = DEMO_PUSH_ENDPOINT;

async function mockPush(context: BrowserContext) {
  await context.addInitScript(installPushMock, ENDPOINT);
}

const pushState = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __push: { shown: string[]; clip: string; subscribed: number; unsubscribed: number };
        }
      ).__push,
  );

test('push: enable, schedule, copy the GitHub secret, sample, disable', async ({
  page,
  context,
}) => {
  await mockPush(context);
  await openApp(page, '/settings');
  const section = page.getByTestId('push-settings');
  await expect(section.getByTestId('push-state')).toHaveText('Aus');

  await page.getByTestId('push-enable').click();
  await expect(section.getByTestId('push-state')).toHaveText('Aktiv auf diesem Gerät');
  await expect(section.getByTestId('push-setup-state')).toHaveText('Noch nicht kopiert');
  // Defaults follow the plan: Sunday 18:00 week plan, reels Tuesday/Thursday.
  await expect(page.getByTestId('push-hour-weekPlan')).toHaveValue('18');
  const reel = page.getByTestId('push-rule-reel');
  await expect(reel.getByRole('button', { name: 'Dienstag' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(reel.getByRole('button', { name: 'Montag' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.getByTestId('push-copy').click();
  await expect(section.getByTestId('push-setup-state')).toHaveText('Einrichtung aktuell');
  const state = await pushState(page);
  const config = JSON.parse(state.clip) as {
    v: number;
    publicKey: string;
    privateKey: string;
    subscription: { endpoint: string };
    timeZone: string;
    schedule: Record<string, { enabled: boolean; weekdays: number[]; hour: number }>;
    messages: Record<string, { title: string }>;
  };
  expect(config.v).toBe(1);
  expect(config.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);
  expect(config.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(config.subscription.endpoint).toBe(ENDPOINT);
  expect(config.timeZone).toBe('Europe/Berlin');
  expect(config.schedule.weekPlan).toEqual({ enabled: true, weekdays: [7], hour: 18 });
  expect(config.schedule.reel?.weekdays).toEqual([2, 4]);
  expect(config.messages.qa?.title).toBe('Heute: Q&A-Story');
  // The key is only copied, never shown.
  await expect(page.getByText(config.privateKey)).toHaveCount(0);

  // Changing the schedule marks the secret as outdated.
  await reel.getByRole('button', { name: 'Montag' }).click();
  await expect(section.getByTestId('push-setup-state')).toHaveText('Geändert – neu kopieren');
  await page.getByTestId('push-copy').click();
  await expect(section.getByTestId('push-setup-state')).toHaveText('Einrichtung aktuell');
  const second = JSON.parse((await pushState(page)).clip) as typeof config;
  expect(second.schedule.reel?.weekdays).toEqual([1, 2, 4]);
  // Same keys and subscription: only the schedule changed.
  expect(second.privateKey).toBe(config.privateKey);
  expect((await pushState(page)).subscribed).toBe(1);

  await page.getByTestId('push-sample').click();
  await expect.poll(async () => (await pushState(page)).shown).toEqual(['Manager']);

  await page.getByTestId('push-disable').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Ausschalten' }).click();
  await expect(section.getByTestId('push-state')).toHaveText('Aus');
  expect((await pushState(page)).unsubscribed).toBe(1);
});

test('push: Safari tab without home screen app explains how to install', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    delete (window as unknown as { PushManager?: unknown }).PushManager;
  });
  await openApp(page, '/settings');
  await expect(page.getByTestId('push-settings')).toContainText('Zum Home-Bildschirm');
  await expect(page.getByTestId('push-enable')).toHaveCount(0);
});
