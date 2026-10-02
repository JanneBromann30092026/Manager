import type { BrowserContextOptions } from '@playwright/test';

export const BASE_PATH = '/Manager/';
export const PREVIEW_PORT = 4173;
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}${BASE_PATH}`;

/** iPad (Safari, home screen app) emulated with Chromium – the only browser in the cloud container. */
const IPAD_BASE = {
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
} satisfies BrowserContextOptions;

export const IPAD_LANDSCAPE = {
  ...IPAD_BASE,
  viewport: { width: 1180, height: 820 },
} satisfies BrowserContextOptions;

export const IPAD_PORTRAIT = {
  ...IPAD_BASE,
  viewport: { width: 820, height: 1180 },
} satisfies BrowserContextOptions;

/** iPhone (Safari, home screen app), portrait. */
export const IPHONE_PORTRAIT = {
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 393, height: 852 },
} satisfies BrowserContextOptions;

/** Password of the E2E tests and screenshots (= E2E_TEST_PASSWORD in src/core/devConstants.ts). */
export const TEST_PASSWORD = 'Manager-Test-2026!';
