import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  configFingerprintSource,
  dueKinds,
  normalizeRule,
  pushConfigSchema,
  zonedParts,
  type PushSchedule,
} from './push';
import { PUSH_DEFAULT_SCHEDULE, PUSH_MESSAGES } from '@/data/templates';

const schedule: PushSchedule = PUSH_DEFAULT_SCHEDULE;

describe('zonedParts', () => {
  it('uses Berlin time in summer (UTC+2)', () => {
    // Sunday 2026-10-04 16:07 UTC = 18:07 CEST
    expect(zonedParts(new Date('2026-10-04T16:07:00Z'))).toEqual({ weekday: 7, hour: 18 });
  });

  it('uses Berlin time in winter (UTC+1)', () => {
    // Monday 2026-11-02 08:07 UTC = 09:07 CET
    expect(zonedParts(new Date('2026-11-02T08:07:00Z'))).toEqual({ weekday: 1, hour: 9 });
  });

  it('crosses midnight into the next weekday', () => {
    // Saturday 23:30 UTC = Sunday 01:30 CEST
    expect(zonedParts(new Date('2026-10-03T23:30:00Z'))).toEqual({ weekday: 7, hour: 1 });
  });
});

describe('dueKinds', () => {
  it('sends the week plan on Sunday evening', () => {
    expect(dueKinds(schedule, { weekday: 7, hour: 18 })).toEqual(['weekPlan']);
  });

  it('sends review on Monday and nothing at other hours', () => {
    expect(dueKinds(schedule, { weekday: 1, hour: 9 })).toEqual(['review']);
    expect(dueKinds(schedule, { weekday: 1, hour: 10 })).toEqual([]);
  });

  it('sends the plan day reminders (Q&A Wednesday, reels Tuesday/Thursday)', () => {
    expect(dueKinds(schedule, { weekday: 3, hour: 9 })).toEqual(['qa']);
    expect(dueKinds(schedule, { weekday: 2, hour: 9 })).toEqual(['reel']);
    expect(dueKinds(schedule, { weekday: 4, hour: 9 })).toEqual(['reel']);
  });

  it('skips disabled rules and can send several at once', () => {
    const custom: PushSchedule = {
      ...schedule,
      review: { enabled: false, weekdays: [1], hour: 9 },
      qa: { enabled: true, weekdays: [1], hour: 9 },
      reel: { enabled: true, weekdays: [1], hour: 9 },
    };
    expect(dueKinds(custom, { weekday: 1, hour: 9 })).toEqual(['qa', 'reel']);
  });
});

describe('helpers', () => {
  it('normalizes weekdays', () => {
    expect(normalizeRule({ enabled: true, weekdays: [4, 2, 4], hour: 8 }).weekdays).toEqual([2, 4]);
  });

  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 251, 255, 1, 2, 62, 63]);
    const text = base64UrlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlDecode(text))).toEqual(Array.from(bytes));
  });

  it('fingerprint changes with schedule and endpoint, not with weekday order', () => {
    const a = configFingerprintSource('https://push.example/1', schedule);
    const reordered = {
      ...schedule,
      reel: { ...schedule.reel, weekdays: [...schedule.reel.weekdays].reverse() },
    };
    expect(configFingerprintSource('https://push.example/1', reordered)).toBe(a);
    expect(configFingerprintSource('https://push.example/2', schedule)).not.toBe(a);
    expect(
      configFingerprintSource('https://push.example/1', {
        ...schedule,
        review: { ...schedule.review, hour: 10 },
      }),
    ).not.toBe(a);
  });
});

describe('pushConfigSchema', () => {
  const config = {
    v: 1,
    subject: 'https://example.org/',
    publicKey: 'BPub_key-123',
    privateKey: 'priv_key-456',
    subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p256', auth: 'auth' } },
    timeZone: 'Europe/Berlin',
    schedule,
    messages: PUSH_MESSAGES,
  };

  it('accepts a complete config', () => {
    expect(pushConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects missing keys or a broken subscription', () => {
    expect(pushConfigSchema.safeParse({ ...config, privateKey: '' }).success).toBe(false);
    expect(
      pushConfigSchema.safeParse({ ...config, subscription: { endpoint: 'nope', keys: {} } })
        .success,
    ).toBe(false);
  });

  it('keeps all texts general (no placeholders, short)', () => {
    for (const message of Object.values(PUSH_MESSAGES)) {
      expect(message.title.length).toBeLessThanOrEqual(40);
      expect(message.body).not.toMatch(/[{}<>]/);
      expect(message.url.startsWith('./#/')).toBe(true);
    }
  });
});
