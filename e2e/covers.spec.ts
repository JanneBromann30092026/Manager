import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openApp, reloadAndUnlock } from './vault.ts';

/** Width and height from the IHDR chunk of a PNG file. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('free text: three variants, rule hints, pose and PNG export in both sizes', async ({
  page,
}) => {
  await openApp(page, '/covers');
  await expect(page.getByRole('heading', { level: 1, name: 'Cover' })).toBeVisible();
  await expect(page.getByTestId('cover-video')).toHaveValue('');
  await expect(page.getByTestId('cover-variant')).toHaveCount(3);
  await expect(page.getByTestId('cover-no-photo')).toBeVisible();

  const reel = page.getByTestId('cover-reel');
  const thumbnail = page.getByTestId('cover-thumbnail');
  await expect(reel).toHaveAttribute('data-ready', 'true');
  await expect(reel).toHaveAttribute('width', '1080');
  await expect(reel).toHaveAttribute('height', '1920');
  await expect(thumbnail).toHaveAttribute('width', '1280');
  await expect(thumbnail).toHaveAttribute('height', '720');
  await expect(page.getByTestId('cover-save-reel')).toBeDisabled();

  await page.getByTestId('cover-text-1').fill('wohin mit dem gehalt?');
  await expect(page.getByTestId('cover-text-1')).toHaveValue('WOHIN MIT DEM GEHALT?');
  await expect(page.getByText('4 Wörter', { exact: true })).toBeVisible();
  await expect(page.getByTestId('cover-pose')).toContainText('Automatisch (Nachdenklich)');

  await page.getByTestId('cover-text-2').fill('Das sind viel zu viele Wörter');
  await expect(page.getByText('Mehr als 4 Wörter')).toBeVisible();
  await expect(page.getByTestId('cover-variant').nth(1)).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('cover-text-3').fill('3 Konten reichen');
  await expect(page.getByTestId('cover-pose')).toContainText('Automatisch (Überrascht)');
  await page.getByTestId('cover-pose').selectOption('happy');
  await expect(page.getByTestId('cover-pose')).toHaveValue('happy');

  // The guide is preview only: switching it off changes the preview, not the export.
  await page.getByRole('switch', { name: /Hilfslinie/ }).click();

  const reelDownload = page.waitForEvent('download');
  await page.getByTestId('cover-save-reel').click();
  const reelFile = await reelDownload;
  expect(reelFile.suggestedFilename()).toBe('cover-reel-3-konten-reichen.png');
  expect(pngSize(await reelFile.path())).toEqual({ width: 1080, height: 1920 });

  const thumbDownload = page.waitForEvent('download');
  await page.getByTestId('cover-save-thumbnail').click();
  const thumbFile = await thumbDownload;
  expect(thumbFile.suggestedFilename()).toBe('thumbnail-3-konten-reichen.png');
  expect(pngSize(await thumbFile.path())).toEqual({ width: 1280, height: 720 });
});

test('package: texts are saved in the cover block, the pose stays with the video', async ({
  page,
}) => {
  await openApp(page, '/videos');
  await page.getByTestId('video-add').click();
  await page.getByTestId('video-topic').fill('So teile ich mein Gehalt auf');
  await page.getByRole('button', { name: 'Paket anlegen' }).click();
  await page.getByTestId('block-cover').getByRole('button', { name: 'Zum Cover-Studio' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Cover' })).toBeVisible();
  await expect(page.getByTestId('cover-video')).toContainText('So teile ich mein Gehalt auf');
  await expect(page.getByText(/noch keine Cover-Texte/)).toBeVisible();
  await page.getByTestId('cover-text-1').fill('Wohin mit dem Gehalt?');
  await page.getByTestId('cover-text-2').fill('3 Konten reichen');
  await page.getByTestId('cover-pose').selectOption('pointing');
  await page.getByTestId('cover-text-2').blur();

  await reloadAndUnlock(page);
  await expect(page.getByTestId('cover-text-1')).toHaveValue('WOHIN MIT DEM GEHALT?');
  await expect(page.getByTestId('cover-text-2')).toHaveValue('3 KONTEN REICHEN');
  await expect(page.getByTestId('cover-pose')).toHaveValue('pointing');

  await page.getByRole('link', { name: 'Zum Paket' }).click();
  await expect(page.getByTestId('block-cover-text')).toHaveValue(
    '1. WOHIN MIT DEM GEHALT?\n2. 3 KONTEN REICHEN',
  );
});
