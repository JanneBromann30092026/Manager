import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { nav, openApp } from './vault.ts';

/** Fixed day for goal and week calculations: Saturday, 03.10.2026 (week 2026-W40). */
const TODAY = new Date('2026-10-03T10:00:00');

async function open(page: Page, route: string) {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, route);
}

async function menu(page: Page, item: string) {
  await page.getByTestId('stats-menu').click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('start values, goal progress and honest status on the start page', async ({ page }) => {
  await open(page, '/start');
  await expect(page.getByText(/Noch kein Followerstand/)).toBeVisible();
  await page.getByRole('link', { name: 'Zu den Zahlen' }).click();
  await page.getByTestId('baseline-import').click();
  await expect(page.getByTestId('followers-card')).toContainText('109');
  await expect(page.getByTestId('baseline-import')).toHaveCount(0);

  await nav(page).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('goal-current')).toHaveText('109 Follower');
  await expect(page.getByTestId('goal-needed')).toHaveText('30,8');
  await expect(page.getByTestId('goal-pace')).toHaveText('10,5');
  await expect(page.getByTestId('goal-status')).toContainText('verfehlt');
  await expect(page.getByTestId('start-next-cta')).toContainText('Teilen');

  // A newer follower count changes the pace.
  await nav(page).getByRole('link', { name: 'Zahlen' }).click();
  await menu(page, 'Followerstand eintragen');
  const form = page.getByTestId('account-form');
  await form.getByLabel('Datum').fill('2026-10-03');
  await page.getByTestId('account-save').click();
  await expect(form.getByText('Bitte die Followerzahl eintragen.')).toBeVisible();
  await page.getByTestId('account-followers').fill('130');
  await page.getByTestId('account-save').click();
  await expect(page.getByTestId('followers-card')).toContainText('130');
  await nav(page).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('goal-current')).toHaveText('130 Follower');
});

test('post by form: main metric, too early hint, weekly report as Markdown', async ({ page }) => {
  await open(page, '/stats');
  await expect(page.getByText('Noch keine Zahlen')).toBeVisible();
  await page.getByTestId('post-add').click();
  const form = page.getByTestId('post-form');
  await page.getByTestId('post-date').fill('2026-09-29');
  await page.getByTestId('post-measured').fill('2026-10-02T09:00');
  await page.getByTestId('post-topic').fill('So teile ich mein Gehalt auf');
  await form.getByLabel('Hook-Typ').selectOption('question');
  await page.getByTestId('post-views').fill('1.200');
  await page.getByTestId('post-newFollowers').fill('9');
  await page.getByTestId('post-nonFollowerPct').fill('120');
  await page.getByTestId('post-save').click();
  await expect(form.getByText('Höchstens 100.')).toBeVisible();
  await page.getByTestId('post-nonFollowerPct').fill('61,5');
  await form.getByText('Retention & Quellen').click();
  await page.getByTestId('post-endHoldPct').fill('18');
  await page.getByTestId('post-reelsTab').fill('70');
  await page.getByTestId('post-save').click();

  const card = page.getByTestId('post-card');
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('post-rate')).toContainText('7,5');
  await expect(page.getByTestId('metric-card').first()).toContainText('7,5');

  // Second post, measured the same day: too early.
  await page.getByTestId('post-add').click();
  await page.getByTestId('post-date').fill('2026-10-03');
  await page.getByTestId('post-measured').fill('2026-10-03T09:00');
  await page.getByTestId('post-topic').fill('Inflation einfach erklärt');
  await page.getByTestId('post-views').fill('400');
  await page.getByTestId('post-newFollowers').fill('1');
  await page.getByTestId('post-save').click();
  await expect(page.getByTestId('post-card').first()).toContainText('zu früh');

  // Edit keeps the values.
  await page.getByTestId('post-card').last().click();
  await expect(page.getByTestId('post-nonFollowerPct')).toHaveValue('61,5');
  await expect(page.getByTestId('post-endHoldPct')).toHaveValue('18');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('post-form')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Report' }).click();
  await expect(page.getByTestId('report-week')).toContainText('2026-W40');
  await expect(page.getByTestId('report-good')).toHaveValue(/So teile ich mein Gehalt auf/);
  await expect(page.getByTestId('report-why')).toHaveValue(/zu früh/);
  await expect(page.getByTestId('report-progress')).toHaveValue(/Kein Followerstand/);
  await expect(page.getByTestId('report-action-3')).not.toHaveValue('');
  await page.getByTestId('report-action-1').fill('Zwei Reels drehen');
  await page.getByTestId('report-save').click();
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByTestId('report-download').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('wochenreport-2026-W40.md');
  const markdown = readFileSync(await file.path(), 'utf8');
  expect(markdown).toContain('# Wochenreport 2026-W40');
  expect(markdown).toContain('1. Zwei Reels drehen');
  expect(markdown).toContain('Neue Follower pro 1.000 Aufrufe: 6,3');
});

test('CSV import: performance and retention land in one post; insights', async ({ page }) => {
  await open(page, '/stats');
  await menu(page, 'CSV importieren');
  const performance = [
    'Datum;Plattform;Format;Thema;Hook;Aufrufe;Nicht-Follower %;Likes;Shares;Saves;Neue Follower;Extra',
    '28.09.2026;Instagram;Reel;Erfundenes Demo-Reel A;Frage;1.000;60;50;4;6;8;x',
    '30.09.2026;Instagram;Reel;Erfundenes Demo-Reel B;Zahl;2.000;45;40;1;2;4;y',
    'kaputt;Instagram;Reel;Ohne Datum;;5;;;;;;',
  ].join('\n');
  await page.getByTestId('import-text').fill(performance);
  await expect(page.getByTestId('import-summary')).toHaveText('2 neu, 0 ergänzt');
  await expect(page.getByTestId('import-errors')).toContainText('Zeile 4');
  await expect(page.getByTestId('import-preview')).toContainText('Ignoriert: Extra');
  await page.getByTestId('import-run').click();
  await expect(page.getByTestId('post-card')).toHaveCount(2);

  await menu(page, 'CSV importieren');
  await page
    .getByTestId('import-text')
    .fill(
      'Datum,Thema,Länge,Sek bis 50,Halten am Ende\n2026-09-28,erfundenes demo-reel a,42,"6,5",18',
    );
  await expect(page.getByTestId('import-summary')).toHaveText('0 neu, 1 ergänzt');
  await page.getByTestId('import-run').click();
  await expect(page.getByTestId('post-card')).toHaveCount(2);
  await page.getByTestId('post-card').filter({ hasText: 'Demo-Reel A' }).click();
  await expect(page.getByTestId('post-views')).toHaveValue('1000');
  await expect(page.getByTestId('post-halfGoneSeconds')).toHaveValue('6,5');
  await page.keyboard.press('Escape');

  await page.getByRole('radio', { name: 'Was wirkt' }).click();
  const hook = page.getByTestId('insights-table').first();
  await expect(hook.locator('tbody tr').first()).toContainText('Frage');
  await expect(hook.locator('tbody tr').first()).toContainText('8');
});

test('screenshot: Claude reads the numbers, the creator confirms them', async ({ page }) => {
  const bodies: { messages: { content: { type: string }[] }[] }[] = [];
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
        content: [
          {
            type: 'text',
            text: '{"platform":"instagram","format":"reel","date":"2026-10-01","views":2345,"newFollowers":12,"nonFollowerPct":58}',
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
  });
  await open(page, '/settings');
  const ai = page.getByTestId('settings-ai');
  await ai.getByRole('switch', { name: 'KI-Unterstützung' }).click();
  await ai.getByTestId('ai-key').fill('sk-ant-e2e-test');
  await ai.getByRole('button', { name: 'Key speichern' }).click();
  await expect(ai.getByTestId('ai-key-state')).toHaveText('API-Key ist gespeichert');

  await nav(page).getByRole('link', { name: 'Zahlen' }).click();
  await menu(page, 'Screenshot auslesen');
  // Invented 1×1 PNG (no real screenshot in the repo).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .getByTestId('screenshot-file')
    .setInputFiles({ name: 'statistik.png', mimeType: 'image/png', buffer: png });
  await page.getByTestId('screenshot-read').click();

  await expect(page.getByTestId('post-read-hint')).toBeVisible();
  expect(bodies[0]!.messages[0]!.content.map((part) => part.type)).toEqual(['image', 'text']);
  await expect(page.getByTestId('post-views')).toHaveValue('2345');
  await expect(page.getByTestId('post-views')).toHaveAttribute('data-read', 'true');
  await expect(page.getByTestId('post-date')).toHaveValue('2026-10-01');
  await expect(page.getByTestId('post-likes')).toHaveValue('');
  await page.getByRole('button', { name: 'Werte geprüft und speichern' }).click();
  const card = page.getByTestId('post-card');
  await expect(card).toContainText('abgelesen');
  await expect(card.getByTestId('post-rate')).toContainText('5,1');
});
