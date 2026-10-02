import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { nav, openApp, reloadAndUnlock } from './vault.ts';

/** 1×1 PNG – invented test image, never a real photo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const FONT = readFileSync(
  fileURLToPath(
    new URL(
      '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      import.meta.url,
    ),
  ),
);

async function openBrand(page: Page) {
  await openApp(page, '/brand');
  await expect(page.getByRole('heading', { level: 1, name: 'Marke' })).toBeVisible();
}

test('shows the channel profile, rules and priorities from the templates', async ({ page }) => {
  await openBrand(page);
  const channel = page.getByTestId('brand-channel');
  await expect(channel).toContainText('dein.Finanzbruder');
  await expect(channel).toContainText('Was ich lerne, hinterfrage & selbst umsetze.');
  await expect(channel).toContainText('CapCut Pro');
  await expect(page.getByTestId('brand-rules')).toContainText('Keine Anlageberatung');
  await expect(page.getByTestId('brand-growth')).toContainText('Q&A-Stories regelmäßig');
  await expect(page.getByTestId('conversion-progress')).toHaveText('0 von 5 erledigt');
});

test('checklist and edits are saved encrypted and survive a reload', async ({ page }) => {
  await openBrand(page);
  await page.getByRole('checkbox', { name: /Highlight „Start hier“/ }).click();
  await page.getByRole('checkbox', { name: /Bio mit klarem Folgen-Grund/ }).click();
  await expect(page.getByTestId('conversion-progress')).toHaveText('2 von 5 erledigt');

  const channel = page.getByTestId('brand-channel-section');
  await channel.getByRole('button', { name: 'Bearbeiten' }).click();
  await channel.getByLabel('Tonalität').fill('Seriös, aber mit Humor.');
  await channel.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('brand-channel')).toContainText('Seriös, aber mit Humor.');

  const rules = page.getByTestId('brand-rules-section');
  await rules.getByRole('button', { name: 'Bearbeiten' }).click();
  const field = rules.getByLabel('Regeln');
  await field.fill(`${await field.inputValue()}\nImmer ein Beispiel aus meinem Alltag.`);
  await rules.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('brand-rules')).toContainText(
    'Immer ein Beispiel aus meinem Alltag.',
  );

  await reloadAndUnlock(page);
  await expect(page.getByTestId('conversion-progress')).toHaveText('2 von 5 erledigt');
  await expect(page.getByTestId('brand-channel')).toContainText('Seriös, aber mit Humor.');

  // Reset back to the templates.
  await page.getByRole('button', { name: 'Auf Vorlage zurücksetzen' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Auf Vorlage zurücksetzen' })
    .click();
  await expect(page.getByTestId('conversion-progress')).toHaveText('0 von 5 erledigt');
  await expect(page.getByTestId('brand-channel')).toContainText('Seriös im Inhalt');
});

test('brand kit: colors, font, photo and poses', async ({ page }) => {
  await openBrand(page);
  const kit = page.getByTestId('brand-kit');

  await kit.getByRole('textbox', { name: 'Brand-Blau', exact: true }).fill('#1D4ED8');
  await expect(page.getByTestId('brand-preview')).toHaveAttribute('style', /29, 78, 216|1d4ed8/i);
  await kit.getByRole('textbox', { name: 'Verlauf dunkel', exact: true }).fill('#12');
  await expect(kit.getByText('Bitte als Hex-Wert eingeben')).toBeVisible();

  await kit.getByTestId('brand-font-input').setInputFiles({
    name: 'kaputt.ttf',
    mimeType: 'font/ttf',
    buffer: Buffer.from('keine Schrift'),
  });
  await expect(page.getByText('Diese Datei ist keine lesbare Schrift.')).toBeVisible();
  await kit.getByTestId('brand-font-input').setInputFiles({
    name: 'Testschrift.woff2',
    mimeType: 'font/woff2',
    buffer: FONT,
  });
  await expect(kit.getByTestId('brand-font-name')).toHaveText('Testschrift.woff2');

  await kit.getByTestId('brand-photo-input').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(kit.getByTestId('brand-photo')).toBeVisible();
  await expect(page.getByTestId('brand-preview').locator('img')).toBeVisible();

  await kit.getByTestId('brand-pose-input').setInputFiles({
    name: 'pose.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  const pose = kit.getByTestId('brand-pose');
  await expect(pose).toHaveCount(1);
  await pose.getByLabel('Stimmung').selectOption('thoughtful');

  await reloadAndUnlock(page);
  await expect(kit.getByTestId('brand-font-name')).toHaveText('Testschrift.woff2');
  await expect(kit.getByTestId('brand-photo')).toBeVisible();
  await expect(kit.getByTestId('brand-pose').getByLabel('Stimmung')).toHaveValue('thoughtful');
  await kit.getByRole('button', { name: 'Pose entfernen' }).click();
  await expect(kit.getByTestId('brand-pose')).toHaveCount(0);
  await expect(nav(page)).toBeVisible();
});
