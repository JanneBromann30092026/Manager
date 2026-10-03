import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { nav, openApp } from './vault.ts';

/** Saturday, 03.10.2026 (week 2026-W40) → the plan opens on next week, 05.10.–11.10. */
const TODAY = new Date('2026-10-03T10:00:00');

async function open(page: Page, route: string) {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, route);
}

async function addIdeas(page: Page, lines: string) {
  await page.getByRole('button', { name: 'Mehrere einfügen' }).first().click();
  await page.getByTestId('bulk-text').fill(lines);
  await page.getByRole('button', { name: 'Alle speichern' }).click();
}

const items = (page: Page) => page.getByTestId('plan-item');

test('suggestion fits Q&A, reels and stories into 4 hours; budget warnings; calendar file', async ({
  page,
}) => {
  await open(page, '/ideas');
  await addIdeas(page, 'Lohnt sich Festgeld?\nWie viel sparen mit 20?\nWas ist ein ETF?');

  await nav(page).getByRole('link', { name: 'Plan' }).click();
  await expect(page.getByTestId('plan-week')).toHaveText('KW 41 · 05.10.2026 – 11.10.2026');
  await expect(page.getByText('Nächste Woche', { exact: true })).toBeVisible();
  await page.getByTestId('plan-suggest').click();

  await expect(items(page)).toHaveCount(5);
  await expect(page.getByTestId('plan-budget-used')).toHaveText('4 Std. von 4 Std.');
  await expect(page.getByTestId('plan-budget-left')).toHaveText('0 Min. frei');
  await expect(items(page).filter({ hasText: 'Q&A-Story: Fragen sammeln' })).toHaveCount(1);
  await expect(items(page).filter({ hasText: 'Skript, Dreh & Schnitt' })).toHaveCount(2);
  await expect(page.getByTestId('plan-warnings')).toHaveCount(0);
  // The third idea did not fit and waits under „Weitere Themen“.
  await expect(page.getByTestId('plan-next').locator('li')).toHaveCount(1);

  // Done toggle.
  const qa = items(page).filter({ hasText: 'Q&A-Story' });
  await qa.getByTestId('plan-item-done').click();
  await expect(qa.getByTestId('plan-item-done')).toHaveAttribute('aria-checked', 'true');

  // More time for a reel → over budget.
  await items(page)
    .filter({ hasText: 'Skript, Dreh & Schnitt' })
    .first()
    .getByRole('button')
    .last()
    .click();
  await page.getByTestId('plan-item-minutes').fill('abc');
  await page.getByTestId('plan-item-save').click();
  await expect(page.getByText('Bitte eine Zahl von 0 bis 720.')).toBeVisible();
  await page.getByTestId('plan-item-minutes').fill('130');
  await page.getByTestId('plan-item-save').click();
  await expect(page.getByTestId('plan-budget-left')).toHaveText('30 Min. über dem Budget');
  await expect(page.getByTestId('plan-warnings')).toContainText('Mehr als dein Zeitbudget');

  // Removing the Q&A story asks for one again.
  await qa.getByRole('button').last().click();
  await page.getByTestId('plan-item-delete').click();
  await expect(page.getByTestId('plan-warnings')).toContainText('Noch keine Q&A-Story');
  await page.getByRole('button', { name: 'Q&A-Story einplanen' }).click();
  await expect(items(page).filter({ hasText: 'Q&A-Story' })).toHaveCount(1);

  // Ideas in the plan are now „Geplant“; only the third one can still move there.
  await nav(page).getByRole('link', { name: 'Ideen' }).click();
  await expect(page.getByTestId('idea-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Weiter: Geplant' })).toHaveCount(1);

  await nav(page).getByRole('link', { name: 'Plan' }).click();
  await page.getByTestId('plan-calendar').click();
  await expect(page.getByTestId('calendar-preview').locator('li')).toHaveCount(5);
  const download = page.waitForEvent('download');
  await page.getByTestId('calendar-download').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('manager-wochenplan-2026-W41.ics');
  const ics = readFileSync(await file.path(), 'utf8');
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
  expect(ics).toContain('DTSTART;VALUE=DATE:20261007');
  expect(ics).toContain('SUMMARY:Q&A-Story: Fragen sammeln (Sticker)');
  expect(ics).toContain('TRIGGER:PT9H');
});

test('time per task is editable; this week shows up on the start page', async ({ page }) => {
  await open(page, '/plan');
  await page.getByTestId('plan-menu').click();
  await page.getByRole('menuitem', { name: 'Zeitbedarf' }).click();
  await page.getByTestId('durations-budget').fill('10');
  await page.getByTestId('durations-save').click();
  await expect(page.getByText(/Bitte nur ganze Minuten/)).toBeVisible();
  await page.getByTestId('durations-budget').fill('180');
  await page.getByTestId('durations-reel').fill('60');
  await page.getByTestId('durations-save').click();

  // This week (W40), started empty.
  await page.getByRole('button', { name: 'Vorherige Woche' }).click();
  await expect(page.getByText('Diese Woche', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leer anfangen' }).click();
  await expect(page.getByTestId('plan-item-minutes')).toHaveValue('60');
  await page.getByTestId('plan-item-kind').selectOption('qa');
  await expect(page.getByTestId('plan-item-minutes')).toHaveValue('20');
  await page.getByTestId('plan-item-day').selectOption('2026-10-03');
  await page.getByTestId('plan-item-title').fill('Q&A-Story posten');
  await page.getByTestId('plan-item-save').click();
  await expect(page.getByTestId('plan-budget-used')).toHaveText('20 Min. von 3 Std.');
  await expect(page.getByTestId('plan-warnings')).toContainText('Noch kein Reel');

  await nav(page).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('start-plan')).toContainText('Q&A-Story posten');
  await page.getByRole('link', { name: 'Zum Wochenplan' }).click();
  await expect(page.getByTestId('plan-week')).toContainText('KW 40');
});
