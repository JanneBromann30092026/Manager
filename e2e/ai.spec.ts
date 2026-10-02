import { expect, test, type Page, type Route } from '@playwright/test';
import { openApp } from './vault.ts';

const API = 'https://api.anthropic.com/**';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function answer(route: Route, status: number, body: unknown) {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  return route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function enableAi(page: Page) {
  await openApp(page, '/settings');
  const section = page.getByTestId('settings-ai');
  await section.getByRole('switch', { name: 'KI-Unterstützung' }).click();
  await expect(section.getByTestId('ai-key-state')).toHaveText('Noch kein API-Key');
  return section;
}

test('AI is off by default and makes no requests', async ({ page }) => {
  const calls: string[] = [];
  await page.route(API, (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  await openApp(page, '/settings');
  const section = page.getByTestId('settings-ai');
  await expect(section.getByRole('switch', { name: 'KI-Unterstützung' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(section.getByTestId('ai-key')).toHaveCount(0);
  expect(calls).toEqual([]);
});

test('stores the key encrypted and tests the connection', async ({ page }) => {
  const requests: { model: string; key: string | null }[] = [];
  let status = 401;
  await page.route(API, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { model: string };
      requests.push({ model: body.model, key: route.request().headers()['x-api-key'] ?? null });
    }
    return status === 200
      ? answer(route, 200, {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5-20251001',
          content: [{ type: 'text', text: 'OK' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 5, output_tokens: 1 },
        })
      : answer(route, 401, {
          type: 'error',
          error: { type: 'authentication_error', message: 'invalid x-api-key' },
        });
  });

  const section = await enableAi(page);
  await expect(section.getByTestId('ai-test')).toBeDisabled();
  await section.getByTestId('ai-key').fill('sk-ant-e2e-falsch');
  await section.getByRole('button', { name: 'Key speichern' }).click();
  await expect(section.getByTestId('ai-key-state')).toHaveText('API-Key ist gespeichert');
  await expect(section.getByTestId('ai-key')).toHaveValue('');

  await section.getByTestId('ai-test').click();
  await expect(section.getByTestId('ai-test-result')).toHaveText('Der API-Key wurde abgelehnt.');

  status = 200;
  await section.getByTestId('ai-model').selectOption('claude-haiku-4-5-20251001');
  await section.getByTestId('ai-test').click();
  await expect(section.getByTestId('ai-test-result')).toContainText('Verbindung klappt');
  expect(requests.at(-1)).toEqual({ model: 'claude-haiku-4-5-20251001', key: 'sk-ant-e2e-falsch' });

  // The key never lands in plaintext in IndexedDB or localStorage.
  const dump = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('manager');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('open failed'));
    });
    const parts: string[] = [];
    for (const name of Array.from(db.objectStoreNames)) {
      const rows = await new Promise<unknown[]>((resolve) => {
        const request = db.transaction(name).objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
      });
      parts.push(
        JSON.stringify(rows, (_key, value: unknown) =>
          value instanceof Uint8Array ? new TextDecoder('latin1').decode(value) : value,
        ),
      );
    }
    db.close();
    return parts.join('\n') + JSON.stringify({ ...localStorage });
  });
  expect(dump).not.toContain('sk-ant-e2e');

  await section.getByRole('button', { name: 'Key löschen' }).click();
  await expect(section.getByTestId('ai-key-state')).toHaveText('Noch kein API-Key');
});

test('custom model ID and the system prompt', async ({ page }) => {
  const section = await enableAi(page);
  await section.getByTestId('ai-model').selectOption('custom');
  const custom = section.getByTestId('ai-model-custom');
  await custom.fill('Claude Sonnet');
  await expect(section.getByText('Bitte eine gültige Modell-ID eingeben.')).toBeVisible();
  await custom.fill('claude-sonnet-5-5-preview');
  await expect(section.getByText('Bitte eine gültige Modell-ID eingeben.')).toHaveCount(0);

  await section.getByRole('button', { name: 'Systemprompt ansehen' }).click();
  const prompt = page.getByTestId('ai-system-prompt');
  await expect(prompt).toContainText('dein.Finanzbruder');
  await expect(prompt).toContainText('Keine Anlageberatung');
  await expect(prompt).toContainText('[Quelle prüfen]');
});
