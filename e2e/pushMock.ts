/**
 * Chromium in the container has no push service: permission, subscription, notifications and
 * the clipboard are replaced by fakes in the page. No real push service, no real keys.
 * Runs in the page (addInitScript or evaluate).
 */
export function installPushMock(endpoint: string): void {
  const w = window as unknown as {
    __push: { shown: string[]; clip: string; subscribed: number; unsubscribed: number };
  };
  w.__push = { shown: [], clip: '', subscribed: 0, unsubscribed: 0 };
  let permission: NotificationPermission = 'default';
  Object.defineProperty(Notification, 'permission', { get: () => permission });
  Notification.requestPermission = () => {
    permission = 'granted';
    return Promise.resolve(permission);
  };
  let subscription: PushSubscription | null = null;
  const pushManager = {
    getSubscription: () => Promise.resolve(subscription),
    subscribe: (options: PushSubscriptionOptionsInit) => {
      w.__push.subscribed += 1;
      const key = new Uint8Array(options.applicationServerKey as Uint8Array).slice().buffer;
      subscription = {
        endpoint,
        options: { applicationServerKey: key, userVisibleOnly: true },
        toJSON: () => ({
          endpoint,
          expirationTime: null,
          keys: { p256dh: 'BDemoP256dhKeyForTests', auth: 'demoAuthSecret' },
        }),
        unsubscribe: () => {
          w.__push.unsubscribed += 1;
          subscription = null;
          return Promise.resolve(true);
        },
      } as unknown as PushSubscription;
      return Promise.resolve(subscription);
    },
  };
  const registration = {
    pushManager,
    showNotification: (title: string) => {
      w.__push.shown.push(title);
      return Promise.resolve();
    },
  };
  Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', {
    get: () => Promise.resolve(registration),
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: (text: string) => {
        w.__push.clip = text;
        return Promise.resolve();
      },
    },
  });
}

export const DEMO_PUSH_ENDPOINT = 'https://push.example.test/demo-subscription';
