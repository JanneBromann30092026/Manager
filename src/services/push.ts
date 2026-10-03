/**
 * Push on this device: permission, VAPID keys (private key only as encrypted secret), the
 * subscription and the configuration the user copies into the GitHub secret MANAGER_PUSH.
 * The app never sends pushes itself; GitHub Actions does (scripts/send-push.ts).
 */
import { z } from 'zod';
import { create } from 'zustand';
import {
  base64UrlDecode,
  base64UrlEncode,
  configFingerprintSource,
  normalizeRule,
  PUSH_KINDS,
  PUSH_TIME_ZONE,
  pushSubscriptionSchema,
  type PushConfig,
  type PushSchedule,
} from '@/core/push';
import { secretsRepo } from '@/data/repositories';
import { PUSH_MESSAGES, PUSH_SUBJECT } from '@/data/templates';
import { isStandalone } from '@/services/displayMode';
import { useVault } from '@/services/vault';

const READY_TIMEOUT_MS = 8000;

export type PushErrorReason = 'unsupported' | 'denied' | 'noWorker' | 'subscribe' | 'noKeys';

export class PushError extends Error {
  constructor(readonly reason: PushErrorReason) {
    super(`Push failed: ${reason}`);
    this.name = 'PushError';
  }
}

export type PushSupport = 'supported' | 'needsHomeScreen' | 'unsupported';

/** iPad/iPhone offer Web Push only to the installed home screen app (iPadOS 16.4+). */
export function pushSupport(): PushSupport {
  const apis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (apis) return 'supported';
  const apple = /iPad|iPhone|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
  return apple && !isStandalone() ? 'needsHomeScreen' : 'unsupported';
}

const keysSchema = z.object({ publicKey: z.string().min(80), privateKey: z.string().min(40) });
type VapidKeys = z.output<typeof keysSchema>;

async function loadKeys(): Promise<VapidKeys | null> {
  const raw = await secretsRepo.get('pushKeys');
  if (!raw) return null;
  const parsed = keysSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

/** New P-256 key pair; the private key leaves the device only inside the copied secret. */
async function createKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  if (!privateJwk.d) throw new PushError('noKeys');
  const keys = { publicKey: base64UrlEncode(publicRaw), privateKey: privateJwk.d };
  await secretsRepo.set('pushKeys', JSON.stringify(keys));
  return keys;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new PushError('unsupported');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PushError('noWorker')), READY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  return base64UrlEncode(new Uint8Array(current)) === publicKey;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

/** Asks for permission (needs a tap) and subscribes this device. */
export async function enablePush(): Promise<void> {
  if (pushSupport() !== 'supported') throw new PushError('unsupported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushError('denied');
  const keys = (await loadKeys()) ?? (await createKeys());
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, keys.publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlDecode(keys.publicKey),
      });
    } catch {
      throw new PushError('subscribe');
    }
  }
  usePushState.getState().reload();
}

/** Unsubscribes this device and forgets the keys (the GitHub secret then stops working). */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription().catch(() => null);
  await subscription?.unsubscribe().catch(() => false);
  await secretsRepo.remove('pushKeys');
  usePushState.getState().reload();
}

/** The GitHub secret: subscription, keys, schedule and the general texts (one line JSON). */
export async function buildPushConfig(schedule: PushSchedule): Promise<string> {
  const keys = await loadKeys();
  const subscription = await currentSubscription();
  if (!keys || !subscription) throw new PushError('noKeys');
  const config: PushConfig = {
    v: 1,
    subject: PUSH_SUBJECT,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subscription: pushSubscriptionSchema.parse(subscription.toJSON()),
    timeZone: PUSH_TIME_ZONE,
    schedule: Object.fromEntries(
      PUSH_KINDS.map((kind) => [kind, normalizeRule(schedule[kind])]),
    ) as PushSchedule,
    messages: PUSH_MESSAGES,
  };
  return JSON.stringify(config);
}

/** Short hash of subscription + schedule: tells whether the copied secret is still current. */
export async function pushFingerprint(endpoint: string, schedule: PushSchedule): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(configFingerprintSource(endpoint, schedule)),
  );
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** Shows the test message locally (checks permission and display, not GitHub). */
export async function showSample(): Promise<void> {
  const reg = await registration();
  const message = PUSH_MESSAGES.test;
  await reg.showNotification(message.title, {
    body: message.body,
    icon: 'icons/pwa-192x192.png',
    tag: 'manager-test',
    data: { url: message.url },
  });
}

interface PushState {
  support: PushSupport;
  permission: NotificationPermission | 'unsupported';
  /** Endpoint of this device's subscription (only for the fingerprint, never shown). */
  endpoint: string | null;
  hasKeys: boolean;
  loaded: boolean;
  reload: () => void;
}

function readPermission(): PushState['permission'] {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

/** Push status for the settings; dropped when the app locks. */
export const usePushState = create<PushState>((set) => ({
  support: 'unsupported',
  permission: 'unsupported',
  endpoint: null,
  hasKeys: false,
  loaded: false,
  reload: () => {
    const support = pushSupport();
    void Promise.all([
      currentSubscription().catch(() => null),
      secretsRepo.has('pushKeys').catch(() => false),
    ]).then(([subscription, hasKeys]) =>
      set({
        support,
        permission: readPermission(),
        endpoint: hasKeys ? (subscription?.endpoint ?? null) : null,
        hasKeys,
        loaded: true,
      }),
    );
  },
}));

useVault.subscribe((state) => {
  if (state.status !== 'unlocked' && usePushState.getState().loaded)
    usePushState.setState({ endpoint: null, hasKeys: false, loaded: false });
});
