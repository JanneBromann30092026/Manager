/**
 * Creates iPad screenshots of the production build (vite preview).
 * Usage: npm run screenshots  →  screenshots/*.png (SHOTS=settings for one group)
 */
import { mkdirSync } from 'node:fs';
import { chromium, type BrowserContextOptions, type Page } from '@playwright/test';
import { preview } from 'vite';
import {
  IPAD_LANDSCAPE,
  IPAD_PORTRAIT,
  IPHONE_PORTRAIT,
  PREVIEW_URL,
  TEST_PASSWORD,
} from './ipad.ts';

interface Shot {
  /** Hash route, e.g. "/tasks". */
  route: string;
  name: string;
  /** Optional interaction before the screenshot (e.g. opening a dialog). */
  prepare?: (page: Page) => Promise<void>;
  /** Additionally screenshot the rest of the scrolling page in viewport-sized steps. */
  scroll?: boolean;
  /** Only in the wide layout (sidebar). */
  wideOnly?: boolean;
}

/** Unlocks after a reload (every reload locks the app). */
async function unlockIfLocked(page: Page) {
  const field = page.getByTestId('unlock-password');
  if (!(await field.isVisible())) return;
  await field.fill(TEST_PASSWORD);
  await page.getByTestId('unlock-submit').click();
  await page.getByTestId('lock-screen').waitFor({ state: 'detached' });
}

/** Height of the iPad on-screen keyboard per orientation (approx., without the shortcut bar). */
const KEYBOARD_HEIGHT = { landscape: 400, portrait: 330 };

/**
 * Chromium has no on-screen keyboard: a fake visualViewport lets the app lay out as with the
 * iPad keyboard (height via window.__setKeyboard), a grey block shows where the keyboard sits.
 */
function simulatedKeyboardScript() {
  const events = new EventTarget();
  let keyboard = 0;
  const viewport = {
    get width() {
      return window.innerWidth;
    },
    get height() {
      return window.innerHeight - keyboard;
    },
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    scale: 1,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  Object.defineProperty(window, 'visualViewport', { get: () => viewport });
  Object.assign(window, {
    __setKeyboard: (height: number) => {
      keyboard = height;
      events.dispatchEvent(new Event('resize'));
      document.getElementById('e2e-keyboard')?.remove();
      if (!height) return;
      const block = document.createElement('div');
      block.id = 'e2e-keyboard';
      block.textContent = 'Bildschirmtastatur (simuliert)';
      Object.assign(block.style, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        height: `${height}px`,
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '500 15px system-ui',
        color: '#6b7280',
        background: 'repeating-linear-gradient(0deg, #d1d5db 0 1px, #e5e7eb 1px 58px)',
        pointerEvents: 'none',
      });
      document.body.append(block);
    },
  });
}

async function setKeyboard(page: Page, on: boolean) {
  const landscape = (page.viewportSize()?.width ?? 0) > (page.viewportSize()?.height ?? 0);
  const height = on ? KEYBOARD_HEIGHT[landscape ? 'landscape' : 'portrait'] : 0;
  await page.evaluate(
    (h) => (window as unknown as { __setKeyboard: (n: number) => void }).__setKeyboard(h),
    height,
  );
  await page.waitForTimeout(300);
}

/** First start: empty setup, a mismatch error with the strength meter, the keyboard. */
async function captureSetup(page: Page, variant: string) {
  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await page.getByTestId('setup-password').waitFor();
  await page.waitForTimeout(700);
  await capture(page, `lock-setup-${variant}`);

  await page.getByTestId('setup-password').fill(TEST_PASSWORD);
  await page.getByTestId('setup-repeat').fill('Manager-Test');
  await page.getByTestId('setup-submit').click();
  await page.getByText('Die Passwörter stimmen nicht überein.').waitFor();
  await page.waitForTimeout(600);
  await capture(page, `lock-setup-error-${variant}`);

  await page.getByTestId('setup-repeat').fill(TEST_PASSWORD);
  await page.getByTestId('setup-repeat').focus();
  await setKeyboard(page, true);
  await capture(page, `lock-setup-keyboard-${variant}`);
  await setKeyboard(page, false);

  await page.getByRole('switch', { name: /Verstanden/ }).click();
  await page.getByTestId('setup-submit').click();
  await page.getByTestId('lock-screen').waitFor({ state: 'detached' });
}

/** Locked: unlock screen, the unlock moment, a wrong password and the wait. */
async function captureUnlock(page: Page, variant: string) {
  await page.goto(`${PREVIEW_URL}#/settings`);
  // Reload: no dialog or overlay from the previous shot.
  await page.reload({ waitUntil: 'networkidle' });
  await unlockIfLocked(page);
  await page.getByTestId('lock-now').click();
  const field = page.getByTestId('unlock-password');
  await field.waitFor();
  await page.waitForTimeout(700);
  await capture(page, `lock-unlock-${variant}`);

  await field.fill(TEST_PASSWORD);
  await page.getByTestId('unlock-submit').click();
  await page.locator('[data-state="success"]').waitFor();
  await page.waitForTimeout(450);
  await capture(page, `lock-opening-${variant}`);
  await page.getByTestId('lock-screen').waitFor({ state: 'detached' });

  await page.getByTestId('sidebar-lock').or(page.getByTestId('lock-now')).first().click();
  for (const attempt of [1, 2, 3]) {
    await field.fill(`falsch-${attempt}`);
    await page.getByTestId('unlock-submit').click();
    await page
      .getByText(attempt < 3 ? 'Das Passwort stimmt nicht.' : /Zu viele Versuche/)
      .waitFor();
    await page.waitForTimeout(700);
    if (attempt === 1) await capture(page, `lock-unlock-error-${variant}`);
  }
  await capture(page, `lock-unlock-wait-${variant}`);
}

async function settingsSecurity(page: Page) {
  await page.getByTestId('settings-security').evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
}

async function settingsYouTube(page: Page) {
  const input = page.getByTestId('youtube-client-id');
  if ((await input.inputValue()) === '') {
    // Invented client id (no real Google project in screenshots).
    await input.fill('123456-demo.apps.googleusercontent.com');
    await page.getByTestId('youtube-client-id-save').click();
    await page.getByText('Client-ID gespeichert.').waitFor({ state: 'detached' });
  }
  await page.getByTestId('settings-youtube').evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
}

async function settingsInstagram(page: Page) {
  await page.getByTestId('settings-instagram').evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
  await page.getByTestId('settings-instagram').locator('summary').click();
}

async function changePassword(page: Page) {
  await page.getByRole('button', { name: 'Passwort ändern' }).click();
  const dialog = page.getByRole('dialog', { name: 'Passwort ändern' });
  await dialog.getByLabel('Aktuelles Passwort').fill(TEST_PASSWORD);
  await dialog.getByLabel('Neues Passwort', { exact: true }).fill('Sonnenblume Fahrrad Wolke');
}

async function devVault(page: Page) {
  const section = page.getByTestId('dev-section-vault');
  for (let i = 0; i < 3; i += 1) {
    await section.getByRole('button', { name: 'Testvideo anlegen' }).click();
    await section
      .getByTestId('vault-video-count')
      .filter({ hasText: String(i + 1) })
      .waitFor();
  }
  await section.getByRole('button', { name: 'Letztes ändern' }).click();
  await section.getByTestId('vault-videos').filter({ hasText: 'Gedreht' }).waitFor();
  await page.waitForTimeout(3200); // let the toasts disappear
}

/** Invented demo ideas (never real data), pasted like Q&A questions. */
const DEMO_IDEAS = [
  'Lohnt sich ein Bausparvertrag?',
  'Wie viel sollte ich mit 20 sparen?',
  'So teile ich mein Gehalt auf',
  'ETF oder Festgeld – was passt zu mir?',
  'Mythos: Versicherungen braucht man erst mit 30',
];

async function ideas(page: Page) {
  if ((await page.getByTestId('idea-card').count()) > 0) return;
  await page.getByRole('button', { name: 'Mehrere einfügen' }).first().click();
  await page.getByTestId('bulk-text').fill(DEMO_IDEAS.join('\n'));
  await page.getByRole('button', { name: 'Alle speichern' }).click();
  await page
    .getByTestId('idea-card')
    .nth(DEMO_IDEAS.length - 1)
    .waitFor();
  await page.getByText(/Ideen gespeichert/).waitFor({ state: 'detached' });
}

async function ideaEditor(page: Page) {
  await ideas(page);
  await page.getByTestId('idea-card').first().getByRole('button').first().click();
  await page.getByTestId('idea-form').waitFor();
}

/** Invented demo package with a filled script (never real data). */
async function videoPackage(page: Page) {
  if ((await page.getByTestId('video-card').count()) === 0) {
    await page.getByTestId('video-add').click();
    await page.getByTestId('video-topic').fill('So teile ich mein Gehalt auf');
    await page.getByRole('button', { name: 'Paket anlegen' }).click();
    await page
      .getByTestId('block-script')
      .getByRole('button', { name: 'Vorlage einfügen' })
      .click();
    await page
      .getByTestId('block-caption')
      .getByRole('button', { name: 'Vorlage einfügen' })
      .click();
    await page.getByTestId('video-status').getByRole('button', { name: 'Skript' }).click();
    await page.getByText('Video-Paket angelegt').waitFor({ state: 'detached' });
  } else {
    await page.getByTestId('video-card').first().click();
  }
  await page.getByTestId('block-script').waitFor();
}

async function videoList(page: Page) {
  await videoPackage(page);
  await page.getByRole('button', { name: 'Zurück zu Videos' }).click();
  await page.getByTestId('video-card').first().waitFor();
}

/** Cover studio for the demo package with invented texts (placeholder silhouette, no photo). */
async function coverStudio(page: Page) {
  await page.goto(`${PREVIEW_URL}#/videos`);
  await page.getByRole('heading', { level: 1, name: 'Videos' }).waitFor();
  await videoPackage(page);
  await page.getByTestId('block-cover').getByRole('button', { name: 'Zum Cover-Studio' }).click();
  const texts = ['Wohin mit dem Gehalt?', '3 Konten reichen', 'Mein Gehalt-Plan'];
  for (const [index, text] of texts.entries()) {
    await page.getByTestId(`cover-text-${index + 1}`).fill(text);
  }
  await page.getByTestId('cover-variant').first().click();
  await page.locator('[data-testid="cover-reel"][data-ready="true"]').waitFor();
  await page.waitForTimeout(400);
}

/** Invented demo numbers (never real statistics), relative to today. */
async function statsDemo(page: Page) {
  await page.goto(`${PREVIEW_URL}#/stats`);
  await page.getByRole('heading', { level: 1, name: 'Zahlen' }).waitFor();
  if ((await page.getByTestId('post-card').count()) === 0) {
    const day = (offset: number) => {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      return date.toISOString().slice(0, 10);
    };
    const csv = [
      'Datum;Format;Thema;Hook;Aufrufe;Nicht-Follower;Shares;Saves;Neue Follower',
      `${day(1)};Reel;So teile ich mein Gehalt auf;Frage;1.840;62;14;31;15`,
      `${day(3)};Reel;3 Fehler beim ersten Depot;Zahl;1.210;48;5;12;6`,
      `${day(8)};Reel;Brauche ich eine Haftpflicht?;Frage;960;55;3;9;7`,
      `${day(10)};Story;Q&A: eure Fragen;;420;12;;;2`,
    ].join('\n');
    await page.getByTestId('stats-menu').click();
    await page.getByRole('menuitem', { name: 'CSV importieren' }).click();
    await page.getByTestId('import-text').fill(csv);
    await page.getByTestId('import-run').click();
    await page.getByTestId('post-card').nth(3).waitFor();
    for (const [offset, followers] of [
      [28, 128],
      [0, 171],
    ] as const) {
      await page.getByTestId('stats-menu').click();
      await page.getByRole('menuitem', { name: 'Followerstand eintragen' }).click();
      await page.getByTestId('account-form').getByLabel('Datum').fill(day(offset));
      await page.getByTestId('account-followers').fill(String(followers));
      await page.getByTestId('account-save').click();
      await page.getByTestId('account-form').waitFor({ state: 'detached' });
    }
    await page
      .getByText(/Followerstand gespeichert/)
      .last()
      .waitFor({ state: 'detached' });
  }
}

async function startDemo(page: Page) {
  await statsDemo(page);
  await page.goto(`${PREVIEW_URL}#/start`);
  await page.getByTestId('goal-current').waitFor();
}

async function planDemo(page: Page) {
  await page.goto(`${PREVIEW_URL}#/ideas`);
  await page.getByRole('heading', { level: 1, name: 'Ideen' }).waitFor();
  await ideas(page);
  await page.goto(`${PREVIEW_URL}#/plan`);
  await page.getByTestId('plan-week').waitFor();
  const suggest = page.getByTestId('plan-suggest');
  if (await suggest.isVisible()) {
    await suggest.click();
    await page.getByTestId('plan-item').first().waitFor();
    await page.getByTestId('plan-item-done').first().click();
    await page.getByText(/Vorschlag erstellt/).waitFor({ state: 'detached' });
  }
}

async function planCalendar(page: Page) {
  await planDemo(page);
  await page.getByTestId('plan-calendar').click();
  await page.getByTestId('calendar-preview').waitFor();
}

const statsTab = (name: string) => async (page: Page) => {
  await statsDemo(page);
  await page.getByRole('radio', { name }).click();
  await page.waitForTimeout(400);
};

async function enableDevMode(page: Page) {
  await page.goto(`${PREVIEW_URL}#/settings`);
  const toggle = page.getByRole('switch', { name: 'Entwicklermodus' });
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
  await page.goto(`${PREVIEW_URL}#/dev/ui`);
  await page.getByTestId('dev-section-buttons').waitFor();
}

const click = (name: string) => async (page: Page) => {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(500);
};

async function focusMode(page: Page) {
  await page.getByTestId('dev-section-focus').scrollIntoViewIfNeeded();
  await click('Fokusmodus testen')(page);
}

async function shortcuts(page: Page) {
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.keyboard.press('Shift+?');
  await page.getByTestId('shortcuts').waitFor();
}

async function collapsedSidebar(page: Page) {
  await click('Seitenleiste einklappen')(page);
  await page.waitForTimeout(400);
}

async function expandSidebar(page: Page) {
  const expand = page.getByRole('button', { name: 'Seitenleiste ausklappen' });
  if (await expand.count()) await expand.click();
}

const SHOTS: Shot[] = [
  { route: '/start', name: 'start', prepare: startDemo, scroll: true },
  { route: '/videos', name: 'videos', prepare: videoList },
  { route: '/covers', name: 'covers', prepare: coverStudio, scroll: true },
  { route: '/stats', name: 'stats', prepare: statsDemo },
  { route: '/plan', name: 'plan', prepare: planDemo, scroll: true },
  { route: '/ideas', name: 'ideas', prepare: ideas },
  { route: '/brand', name: 'brand' },
  { route: '/settings', name: 'settings', scroll: true },
  { route: '/ideas', name: 'ideas-editor', prepare: ideaEditor },
  { route: '/videos', name: 'video-package', prepare: videoPackage, scroll: true },
  { route: '/settings', name: 'settings-security', prepare: settingsSecurity },
  { route: '/settings', name: 'settings-password', prepare: changePassword },
  { route: '/settings', name: 'settings-youtube', prepare: settingsYouTube },
  { route: '/settings', name: 'settings-instagram', prepare: settingsInstagram },
  { route: '/stats', name: 'stats-report', prepare: statsTab('Report'), scroll: true },
  { route: '/stats', name: 'stats-insights', prepare: statsTab('Was wirkt') },
  { route: '/plan', name: 'plan-calendar', prepare: planCalendar },
  { route: '/dev/ui', name: 'dev-ui', prepare: enableDevMode, scroll: true },
  { route: '/dev/ui', name: 'dev-vault', prepare: devVault },
  { route: '/dev/ui', name: 'dev-modal', prepare: click('Modal öffnen') },
  { route: '/dev/ui', name: 'dev-sheet', prepare: click('Bottom Sheet öffnen') },
  { route: '/dev/ui', name: 'dev-side-panel', prepare: click('Seitenpanel öffnen') },
  { route: '/dev/ui', name: 'dev-focus', prepare: focusMode },
  { route: '/start', name: 'shortcuts', prepare: shortcuts },
  { route: '/videos', name: 'sidebar-collapsed', prepare: collapsedSidebar, wideOnly: true },
];

/** Split View only gets the section pages and the settings. */
const SPLIT_SHOTS = 8;

const VARIANTS: { name: string; options: BrowserContextOptions }[] = [
  { name: 'landscape-dark', options: { ...IPAD_LANDSCAPE, colorScheme: 'dark' } },
  { name: 'landscape-light', options: { ...IPAD_LANDSCAPE, colorScheme: 'light' } },
  { name: 'portrait-dark', options: { ...IPAD_PORTRAIT, colorScheme: 'dark' } },
  { name: 'portrait-light', options: { ...IPAD_PORTRAIT, colorScheme: 'light' } },
  // Split View: half of a landscape iPad Air (narrowest supported width ≈ 500 px).
  {
    name: 'split-dark',
    options: { ...IPAD_PORTRAIT, viewport: { width: 500, height: 820 }, colorScheme: 'dark' },
  },
  { name: 'iphone-dark', options: { ...IPHONE_PORTRAIT, colorScheme: 'dark' } },
  { name: 'iphone-light', options: { ...IPHONE_PORTRAIT, colorScheme: 'light' } },
];

/** Optional name prefix, e.g. SHOTS=dev npm run screenshots. */
const ONLY = process.env.SHOTS;

const outDir = new URL('../screenshots/', import.meta.url);
mkdirSync(outDir, { recursive: true });

async function capture(page: Page, name: string) {
  const file = new URL(`${name}.png`, outDir).pathname;
  await page.screenshot({ path: file });
  console.log(`✓ ${file}`);
}

/** Icon preview: home screen icon, maskable icon in a circle, tab icon and startup images. */
async function captureIconPreview() {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  const icon = (file: string) => `${PREVIEW_URL}icons/${file}`;
  const splash = (file: string) => `${PREVIEW_URL}splash/${file}`;
  const panel = (theme: 'dark' | 'light') => {
    const fg = theme === 'dark' ? '#e6ebf5' : '#0d1321';
    const muted = theme === 'dark' ? '#9ba5b8' : '#4a5467';
    const bg = theme === 'dark' ? '#090d16' : '#f3f5f9';
    return `
      <section style="background:${bg};color:${fg};padding:28px 32px;display:flex;gap:40px;align-items:flex-end">
        <figure><img src="${icon('apple-touch-icon-180x180.png')}" width="120" height="120" style="border-radius:27px"><figcaption>Manager</figcaption><small style="color:${muted}">iPad-Homescreen</small></figure>
        <figure><img src="${icon('maskable-icon-512x512.png')}" width="120" height="120" style="border-radius:50%"><figcaption>maskable</figcaption><small style="color:${muted}">Kreismaske</small></figure>
        <figure><img src="${icon('pwa-512x512.png')}" width="120" height="120"><figcaption>pwa-512</figcaption><small style="color:${muted}">transparent</small></figure>
        <figure><span style="display:flex;gap:12px;align-items:center;height:120px"><img src="${icon('favicon.svg')}" width="32" height="32"><img src="${icon('favicon.svg')}" width="16" height="16"></span><figcaption>Favicon</figcaption><small style="color:${muted}">32 / 16 px</small></figure>
        <figure><img src="${splash(`splash-1640x2360-${theme}.png`)}" height="200" style="border-radius:12px;border:1px solid ${muted}55"><figcaption>Startbild</figcaption><small style="color:${muted}">${theme === 'dark' ? 'dunkel' : 'hell'}</small></figure>
      </section>`;
  };
  await page.setContent(`<!doctype html><html><body style="margin:0;font:500 15px system-ui">
    <style>figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}</style>
    ${panel('dark')}${panel('light')}</body></html>`);
  await page.waitForLoadState('networkidle');
  const size = await page.evaluate(() => ({
    width: document.body.scrollWidth,
    height: document.body.scrollHeight,
  }));
  await page.setViewportSize(size);
  await capture(page, 'icon-preview');
  await context.close();
}

const server = await preview();
const browser = await chromium.launch();
try {
  if (!ONLY || 'icon-preview'.startsWith(ONLY)) await captureIconPreview();
  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      ...variant.options,
      // Keep screenshots free of the "offline ready" toast.
      serviceWorkers: 'block',
    });
    await context.addInitScript(simulatedKeyboardScript);
    const page = await context.newPage();
    const wide = (variant.options.viewport?.width ?? 0) >= 900;
    if (!ONLY || 'lock'.startsWith(ONLY) || ONLY.startsWith('lock')) {
      await captureSetup(page, variant.name);
    } else {
      await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
      await page.getByTestId('setup-password').fill(TEST_PASSWORD);
      await page.getByTestId('setup-repeat').fill(TEST_PASSWORD);
      await page.getByRole('switch', { name: /Verstanden/ }).click();
      await page.getByTestId('setup-submit').click();
      await page.getByTestId('lock-screen').waitFor({ state: 'detached' });
    }
    // A filtered run still needs the developer mode (normally enabled by the dev-ui shot).
    if (ONLY) await enableDevMode(page);
    const shots = SHOTS.filter((s) => !ONLY || s.name.startsWith(ONLY));
    for (const shot of variant.name.startsWith('split') || variant.name.startsWith('iphone')
      ? shots.slice(0, SPLIT_SHOTS)
      : shots) {
      if (shot.wideOnly && !wide) continue;
      await page.goto(`${PREVIEW_URL}#${shot.route}`, { waitUntil: 'networkidle' });
      // Same hash = no navigation; reload so dialogs from the previous shot are gone.
      await page.reload({ waitUntil: 'networkidle' });
      await unlockIfLocked(page);
      await page.waitForTimeout(400);
      await shot.prepare?.(page);
      const container = page.locator('[data-scroll-container]');
      if (shot.scroll) {
        await container.evaluate((element) => {
          element.scrollTop = 0;
        });
      }
      await page.waitForTimeout(700);
      await capture(page, `${shot.name}-${variant.name}`);
      if (shot.name === 'sidebar-collapsed') await expandSidebar(page);
      if (!shot.scroll) continue;
      for (let part = 2; part <= 8; part += 1) {
        const moved = await container.evaluate((element) => {
          const before = element.scrollTop;
          element.scrollTop += element.clientHeight - 80;
          return element.scrollTop !== before;
        });
        if (!moved) break;
        await page.waitForTimeout(300);
        await capture(page, `${shot.name}-${part}-${variant.name}`);
      }
    }
    if (!variant.name.startsWith('split') && (!ONLY || ONLY.startsWith('lock')))
      await captureUnlock(page, variant.name);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
