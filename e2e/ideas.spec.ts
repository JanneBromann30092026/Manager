import { expect, test, type Page } from '@playwright/test';
import { nav, openApp, reloadAndUnlock } from './vault.ts';

const cards = (page: Page) => page.getByTestId('idea-card');

async function openIdeas(page: Page) {
  await openApp(page, '/ideas');
  await expect(page.getByRole('heading', { level: 1, name: 'Ideen' })).toBeVisible();
}

test('captures one idea with series, hook and personal flag', async ({ page }) => {
  await openIdeas(page);
  await expect(page.getByText('Noch keine Ideen')).toBeVisible();
  await page.getByTestId('idea-add').click();
  const form = page.getByTestId('idea-form');
  await form.getByRole('button', { name: 'Idee speichern' }).click();
  await expect(form.getByText('Bitte ein Thema eingeben.')).toBeVisible();

  await page.getByTestId('idea-title').fill('So teile ich mein Gehalt auf');
  // First-person topics are preselected as personal.
  await expect(form.getByRole('switch', { name: /Persönliches Thema/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await form.getByRole('button', { name: 'Geldfehler mit 20' }).click();
  await expect(page.getByTestId('idea-series')).toHaveValue('Geldfehler mit 20');
  await form.getByLabel('Hook-Typ').selectOption('number');
  await form.getByRole('button', { name: 'Idee speichern' }).click();

  await expect(cards(page)).toHaveCount(1);
  const card = cards(page).first();
  await expect(card).toContainText('So teile ich mein Gehalt auf');
  await expect(card).toContainText('Persönlich');
  await expect(card).toContainText('Geldfehler mit 20');
  await expect(card).toContainText('Zahl');

  await reloadAndUnlock(page);
  await expect(cards(page)).toHaveCount(1);
});

test('pastes several community questions and sorts them first', async ({ page }) => {
  await openIdeas(page);
  await page.getByTestId('idea-add').click();
  await page.getByTestId('idea-title').fill('Inflation einfach erklärt');
  await page.getByRole('button', { name: 'Idee speichern' }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.getByRole('button', { name: 'Mehrere einfügen' }).click();
  await expect(page.getByRole('button', { name: 'Alle speichern' })).toBeDisabled();
  await page
    .getByTestId('bulk-text')
    .fill(
      '- Lohnt sich ein Bausparvertrag?\n• ETF oder Festgeld?\n\n- Lohnt sich ein Bausparvertrag?',
    );
  await expect(page.getByTestId('bulk-preview')).toHaveText('2 Ideen werden angelegt');
  await page.getByRole('button', { name: 'Alle speichern' }).click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByTestId('idea-count')).toHaveText('3 Ideen');
  // Community questions rank above the lexicon topic.
  await expect(cards(page).last()).toContainText('Inflation einfach erklärt');
  await expect(cards(page).first()).toContainText('Community-Frage');

  await page.getByTestId('filter-source').selectOption('community');
  await expect(cards(page)).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Ideen durchsuchen' }).fill('festgeld');
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Ideen durchsuchen' }).fill('gibt es nicht');
  await expect(page.getByText('Keine passenden Ideen')).toBeVisible();
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(cards(page)).toHaveCount(3);
});

test('moves ideas along the status flow, starts a video and deletes', async ({ page }) => {
  await openIdeas(page);
  await page.getByRole('button', { name: 'Mehrere einfügen' }).first().click();
  await page.getByTestId('bulk-text').fill('Lohnt sich ein Bausparvertrag?\nETF oder Festgeld?');
  await page.getByRole('button', { name: 'Alle speichern' }).click();
  await expect(cards(page)).toHaveCount(2);

  const first = cards(page).filter({ hasText: 'Bausparvertrag' });
  await first.getByRole('button', { name: 'Weiter: Geplant' }).click();
  await expect(first).toContainText('Geplant');
  await first.getByRole('button', { name: 'Weiter: Gedreht' }).click();
  // Filmed ideas leave the default "open" view.
  await expect(cards(page)).toHaveCount(1);
  await page.getByTestId('filter-status').selectOption('filmed');
  await expect(cards(page)).toHaveCount(1);
  await page.getByTestId('filter-status').selectOption('open');

  await cards(page).first().getByRole('button').first().click();
  await page.getByRole('button', { name: 'Neues Video starten' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Videos' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Ideen' }).click();
  await expect(cards(page).first()).toContainText('Geplant');

  await cards(page).first().getByRole('button').first().click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText('Keine passenden Ideen')).toBeVisible();
});
