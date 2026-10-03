/**
 * Push reminders (step 11): general texts without personal data – GitHub sends them, so they
 * must never contain topics, numbers or names. Weekdays default to the plan slots.
 */
import type { PushMessage, PushMessageKind, PushSchedule } from '@/core/push';
import { PLAN_SLOTS } from './plan';

export const PUSH_MESSAGES: Record<PushMessageKind, PushMessage> = {
  weekPlan: {
    title: 'Wochenplan',
    body: 'Zeit für den Wochenplan für nächste Woche.',
    url: './#/plan',
  },
  review: {
    title: 'Auswertung',
    body: 'Zeit für die Auswertung der letzten Woche.',
    url: './#/stats',
  },
  qa: { title: 'Heute: Q&A-Story', body: 'Sammle heute Fragen mit dem Sticker.', url: './#/plan' },
  reel: {
    title: 'Heute: Reel drehen',
    body: 'Heute steht ein Reel auf dem Plan.',
    url: './#/plan',
  },
  test: { title: 'Manager', body: 'Mitteilungen funktionieren.', url: './#/start' },
};

export const PUSH_DEFAULT_SCHEDULE: PushSchedule = {
  weekPlan: { enabled: true, weekdays: [7], hour: 18 },
  review: { enabled: true, weekdays: [1], hour: 9 },
  qa: { enabled: true, weekdays: [PLAN_SLOTS.qa], hour: 9 },
  reel: { enabled: true, weekdays: [...PLAN_SLOTS.reels], hour: 9 },
};

/** VAPID subject: the app itself (the push services only need a contact URL). */
export const PUSH_SUBJECT = 'https://jannebromann30092026.github.io/Manager/';

/** Where the user stores the secret and starts a test run (public repository). */
export const PUSH_SECRET_NAME = 'MANAGER_PUSH';
export const PUSH_GITHUB_LINKS = {
  newSecret: 'https://github.com/JanneBromann30092026/Manager/settings/secrets/actions/new',
  secrets: 'https://github.com/JanneBromann30092026/Manager/settings/secrets/actions',
  workflow: 'https://github.com/JanneBromann30092026/Manager/actions/workflows/push.yml',
} as const;
