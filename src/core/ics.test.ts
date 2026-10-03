import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine } from './ics';

describe('ics', () => {
  it('escapes text values', () => {
    expect(escapeText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const folded = foldLine(`SUMMARY:${'ä'.repeat(60)}`);
    for (const line of folded.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'ä'.repeat(60)}`);
  });

  it('builds all-day events with a reminder at 9:00 the same day', () => {
    const ics = buildIcs(
      [{ uid: 'abc', date: '2026-10-06', summary: 'Reel: Test', description: '100 Min.' }],
      new Date('2026-10-03T10:00:00Z'),
      { alarm: 'Heute im Plan' },
    );
    expect(ics).toContain('UID:abc@manager\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261006\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20261007\r\n');
    expect(ics).toContain('DTSTAMP:20261003T100000Z\r\n');
    expect(ics).toContain('TRIGGER:PT9H\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(buildIcs([], new Date(), { alarm: 'x', alarmHours: -15 })).not.toContain('TRIGGER');
    expect(
      buildIcs([{ uid: 'a', date: '2026-10-06', summary: 's' }], new Date(), {
        alarm: 'x',
        alarmHours: -15,
      }),
    ).toContain('TRIGGER:-PT15H');
  });
});
