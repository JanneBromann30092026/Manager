import { expect, test, type Page, type Route } from '@playwright/test';
import { nav, openApp, reloadAndUnlock } from './vault.ts';

async function createVideo(page: Page, topic: string, kind?: 'Podcast') {
  await page.getByTestId('video-add').click();
  await page.getByTestId('video-topic').fill(topic);
  if (kind) await page.getByTestId('video-create').getByRole('button', { name: kind }).click();
  await page.getByRole('button', { name: 'Paket anlegen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: topic })).toBeVisible();
}

test('creates a package, fills the script from the template and publishes it', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page, '/videos');
  await expect(page.getByText('Noch keine Video-Pakete')).toBeVisible();
  await page.getByTestId('video-add').click();
  await expect(page.getByTestId('video-create-cta')).toContainText('Teilen');
  await page.getByRole('button', { name: 'Paket anlegen' }).click();
  await expect(page.getByText('Bitte ein Thema eingeben.')).toBeVisible();
  await page.getByTestId('video-topic').fill('So investiere ich in ETFs');
  await page.getByRole('button', { name: 'Paket anlegen' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'So investiere ich in ETFs' }),
  ).toBeVisible();

  // Reel: six blocks, no clips.
  for (const key of ['script', 'cutList', 'cover', 'caption', 'youtube', 'communityQuestion']) {
    await expect(page.getByTestId(`block-${key}`)).toBeVisible();
  }
  await expect(page.getByTestId('block-clips')).toHaveCount(0);
  await expect(page.getByTestId('video-cta')).toHaveValue('share');

  const script = page.getByTestId('block-script');
  await script.getByRole('button', { name: 'Vorlage einfügen' }).click();
  await expect(page.getByTestId('block-script-text')).toHaveValue(/HOOKS/);
  const check = page.getByTestId('video-check');
  await expect(check.locator('[data-ok="false"]')).toHaveCount(3); // hook, no advice, gaps

  await page
    .getByTestId('block-script-text')
    .fill(
      'HOOKS\n1. Frage: „Wohin mit deinem Geld am Monatsende?“\nHAUPTTEIL\nIch spare per Sparplan.\nFolg mir für mehr.',
    );
  await page.getByTestId('block-script-text').blur();
  await expect(check.locator('[data-ok="false"]')).toHaveCount(1);
  await check.getByRole('button', { name: 'Hinweis ins Skript einfügen' }).click();
  await expect(page.getByTestId('video-check-summary')).toHaveText('Alles erfüllt.');
  await expect(page.getByTestId('block-script-text')).toHaveValue(/Keine Anlageberatung\.$/);

  await script.getByRole('button', { name: 'Kopieren' }).click();
  await expect(page.getByText('Kopiert')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'Wohin mit deinem Geld',
  );

  await page.getByTestId('video-status').getByRole('button', { name: 'Gedreht' }).click();
  await expect(
    page.getByTestId('video-status').getByRole('button', { name: 'Gedreht' }),
  ).toHaveAttribute('aria-current', 'step');
  await check.getByRole('button', { name: 'Als veröffentlicht markieren' }).click();
  await expect(page.getByText('Als veröffentlicht markiert')).toBeVisible();
  await page.getByText('Verlauf').click();
  await expect(page.getByTestId('video-history').locator('li')).toHaveCount(3);

  await reloadAndUnlock(page);
  await expect(page.getByTestId('block-script-text')).toHaveValue(/Wohin mit deinem Geld/);
  await nav(page).getByRole('link', { name: 'Videos' }).click();
  await expect(page.getByTestId('video-card')).toContainText('Veröffentlicht');
  await expect(page.getByTestId('next-cta')).toHaveText('Nächster CTA: Kommentar-Frage');
});

test('podcasts get clips; the CTA rotates and can be changed', async ({ page }) => {
  await openApp(page, '/videos');
  await createVideo(page, 'Podcast #1: Geld mit 20', 'Podcast');
  await expect(page.getByTestId('block-clips')).toBeVisible();
  await expect(page.getByTestId('video-cta')).toHaveValue('share');
  await page.getByRole('button', { name: 'Zurück zu Videos' }).click();
  await createVideo(page, 'Notgroschen');
  await expect(page.getByTestId('video-cta')).toHaveValue('comment');
  await page.getByTestId('video-cta').selectOption('follow');
  await page.getByRole('button', { name: 'Zurück zu Videos' }).click();
  await expect(page.getByTestId('next-cta')).toHaveText('Nächster CTA: Teilen');
  await expect(page.getByTestId('video-card')).toHaveCount(2);

  await page.getByTestId('video-card').filter({ hasText: 'Notgroschen' }).click();
  await page.getByRole('button', { name: 'Paket löschen' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Paket löschen' }).click();
  await expect(page.getByTestId('video-card')).toHaveCount(1);
});

test('Claude writes a block with the central system prompt', async ({ page }) => {
  const bodies: { system?: string; messages: { content: string }[] }[] = [];
  await page.route('https://api.anthropic.com/**', (route: Route) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    bodies.push(route.request().postDataJSON() as (typeof bodies)[number]);
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: 'Erfundene Test-Caption #geld' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
  });
  await openApp(page, '/settings');
  const ai = page.getByTestId('settings-ai');
  await ai.getByRole('switch', { name: 'KI-Unterstützung' }).click();
  await ai.getByTestId('ai-key').fill('sk-ant-e2e-test');
  await ai.getByRole('button', { name: 'Key speichern' }).click();
  await expect(ai.getByTestId('ai-key-state')).toHaveText('API-Key ist gespeichert');

  await nav(page).getByRole('link', { name: 'Videos' }).click();
  await createVideo(page, 'Lohnt sich ein Bausparvertrag?');
  const caption = page.getByTestId('block-caption');
  await caption.getByRole('button', { name: 'Mit Claude erzeugen' }).click();
  await expect(page.getByTestId('block-caption-text')).toHaveValue('Erfundene Test-Caption #geld');
  await expect(caption.getByText('(Claude)')).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]!.system).toContain('Keine Anlageberatung');
  expect(bodies[0]!.messages[0]!.content).toContain('Lohnt sich ein Bausparvertrag?');

  // Editing turns the draft into the creator's own text.
  await page.getByTestId('block-caption-text').fill('Meine eigene Caption');
  await page.getByTestId('block-caption-text').blur();
  await expect(caption.getByText('(Claude)')).toHaveCount(0);
});
