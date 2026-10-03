/**
 * Push reminders (Web Push, VAPID). The app subscribes on the device; a GitHub Actions job sends
 * general texts at the configured hours. Everything the job needs (subscription, VAPID keys,
 * schedule, texts) travels in one GitHub secret that the user copies from the app – no server,
 * no personal data in the messages.
 *
 * Runtime imports: only zod. The send script (scripts/send-push.ts) imports this file directly.
 */
import { z } from 'zod';

export const PUSH_KINDS = ['weekPlan', 'review', 'qa', 'reel'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushMessageKind = PushKind | 'test';

/** Time zone of the schedule (GitHub runs in UTC; daylight saving is handled here). */
export const PUSH_TIME_ZONE = 'Europe/Berlin';
/** Hours the user can pick (GitHub runs the job once an hour). */
export const PUSH_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const weekdaySchema = z.int().min(1).max(7);
const hourSchema = z.int().min(0).max(23);

export const pushRuleSchema = z.object({
  enabled: z.boolean(),
  weekdays: z.array(weekdaySchema).max(7),
  hour: hourSchema,
});
export type PushRule = z.output<typeof pushRuleSchema>;

export const pushScheduleSchema = z.object({
  weekPlan: pushRuleSchema,
  review: pushRuleSchema,
  qa: pushRuleSchema,
  reel: pushRuleSchema,
});
export type PushSchedule = z.output<typeof pushScheduleSchema>;

export const pushMessageSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().max(200),
  /** Relative to the app scope, e.g. "./#/plan". */
  url: z.string().max(200),
});
export type PushMessage = z.output<typeof pushMessageSchema>;

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: base64Url, auth: base64Url }),
});
export type PushSubscriptionData = z.output<typeof pushSubscriptionSchema>;

/** Content of the GitHub secret MANAGER_PUSH. */
export const pushConfigSchema = z.object({
  v: z.literal(1),
  subject: z.string().regex(/^(https:\/\/|mailto:)/),
  publicKey: base64Url,
  privateKey: base64Url,
  subscription: pushSubscriptionSchema,
  timeZone: z.string().min(1),
  schedule: pushScheduleSchema,
  messages: z.object({
    weekPlan: pushMessageSchema,
    review: pushMessageSchema,
    qa: pushMessageSchema,
    reel: pushMessageSchema,
    test: pushMessageSchema,
  }),
});
export type PushConfig = z.output<typeof pushConfigSchema>;

export interface ZonedParts {
  /** ISO weekday, 1 = Monday. */
  weekday: number;
  hour: number;
}

const WEEKDAY_NUMBERS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Weekday and hour of a moment in a time zone (daylight saving included). */
export function zonedParts(moment: Date, timeZone: string = PUSH_TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { weekday: WEEKDAY_NUMBERS[value('weekday')] ?? 1, hour: Number(value('hour')) % 24 };
}

/** Reminders due in this hour. */
export function dueKinds(schedule: PushSchedule, at: ZonedParts): PushKind[] {
  return PUSH_KINDS.filter((kind) => {
    const rule = schedule[kind];
    return rule.enabled && rule.hour === at.hour && rule.weekdays.includes(at.weekday);
  });
}

/** Normalises a rule: weekdays unique and sorted. */
export function normalizeRule(rule: PushRule): PushRule {
  return { ...rule, weekdays: [...new Set(rule.weekdays)].sort((a, b) => a - b) };
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * What the copied secret depends on (subscription + schedule). The app stores a hash of it to
 * tell whether the secret on GitHub is still current.
 */
export function configFingerprintSource(endpoint: string, schedule: PushSchedule): string {
  const rules = PUSH_KINDS.map((kind) => {
    const rule = normalizeRule(schedule[kind]);
    return `${kind}:${rule.enabled ? 1 : 0}:${rule.weekdays.join('')}:${rule.hour}`;
  });
  return `${endpoint}|${rules.join('|')}`;
}
