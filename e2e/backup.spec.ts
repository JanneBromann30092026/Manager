import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { TEST_PASSWORD } from './ipad.ts';
import { nav, openApp } from './vault.ts';

const cards = (page: Page) => page.getByTestId('idea-card');

async function addIdeas(page: Page, text: string) {
  await page.getByRole('button', { name: 'Mehrere einfügen' }).first().click();
  await page.getByTestId('bulk-text').fill(text);
  await page.getByRole('button', { name: 'Alle speichern' }).click();
}

test('backup: reminder, encrypted export, restore replaces all data', async ({ page }) => {
  await openApp(page, '/ideas');
  await addIdeas(page, 'Erfundene Demo-Idee A\nErfundene Demo-Idee B');
  await expect(cards(page)).toHaveCount(2);

  // With data and no backup yet, the start page reminds.
  await nav(page).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('backup-reminder')).toContainText('noch kein Backup');
  await page.getByTestId('backup-reminder').getByRole('button', { name: 'Jetzt sichern' }).click();

  const dialog = page.getByRole('dialog', { name: 'Backup erstellen' });
  await expect(dialog).toBeVisible();
  await page.getByTestId('backup-password').fill('falsch-falsch');
  await page.getByTestId('backup-encrypt').click();
  await expect(dialog.getByText('Das Passwort stimmt nicht.')).toBeVisible();
  await page.getByTestId('backup-password').fill(TEST_PASSWORD);
  await page.getByTestId('backup-encrypt').click();
  await expect(page.getByTestId('backup-ready')).toHaveText(
    /^manager-backup-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  const file = readFileSync(path, 'utf8');
  expect(JSON.parse(file)).toMatchObject({ format: 'manager-backup', version: 1 });
  expect(file).not.toContain('Erfundene Demo-Idee');
  await expect(page.getByTestId('backup-last')).toContainText('Letztes Backup:');

  await nav(page).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByTestId('backup-reminder')).toHaveCount(0);

  // More ideas after the backup – restoring brings back exactly the backup.
  await nav(page).getByRole('link', { name: 'Ideen' }).click();
  await addIdeas(page, 'Kommt nach dem Backup');
  await expect(cards(page)).toHaveCount(3);

  await nav(page).getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByTestId('backup-file').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(file),
  });
  await page.getByTestId('backup-restore-password').fill('falsch-falsch');
  await page.getByTestId('backup-check').click();
  await expect(page.getByText('Das Passwort passt nicht zu diesem Backup.')).toBeVisible();
  await page.getByTestId('backup-restore-password').fill(TEST_PASSWORD);
  await page.getByTestId('backup-check').click();
  const preview = page.getByTestId('backup-preview');
  await expect(preview).toContainText('Ideen');
  await expect(preview).toContainText('2');
  await expect(preview).toContainText('ersetzt alle Daten');
  await page.getByTestId('backup-replace').click();
  await expect(page.getByText('Backup eingespielt.')).toBeVisible();

  await nav(page).getByRole('link', { name: 'Ideen' }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByText('Kommt nach dem Backup')).toHaveCount(0);
});

test('backup: a foreign file is rejected', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByTestId('backup-file').setInputFiles({
    name: 'notizen.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await page.getByTestId('backup-restore-password').fill(TEST_PASSWORD);
  await page.getByTestId('backup-check').click();
  await expect(page.getByText('Das ist keine Manager-Backup-Datei.')).toBeVisible();
});

test('CSV export of posts can be downloaded', async ({ page }) => {
  await openApp(page, '/stats');
  await page.getByTestId('post-add').click();
  await page.getByTestId('post-date').fill('2026-09-29');
  await page.getByTestId('post-measured').fill('2026-10-02T09:00');
  await page.getByTestId('post-topic').fill('Erfundenes Demo-Reel');
  await page.getByTestId('post-views').fill('1.200');
  await page.getByTestId('post-newFollowers').fill('9');
  await page.getByTestId('post-save').click();
  await expect(page.getByTestId('post-card')).toHaveCount(1);

  await nav(page).getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByTestId('csv-followers')).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('csv-posts').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^manager-beitraege-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('Datum;Plattform;Format;Thema');
  expect(csv).toContain('2026-09-29;instagram;reel;Erfundenes Demo-Reel;;1200;');
  expect(csv).toContain(';9;7,5;');
});
