import { describe, expect, it } from 'vitest';
import { backupFileName, backupReminder, base64ToBytes, bytesToBase64 } from './backup';

describe('backupReminder', () => {
  const now = new Date('2026-10-20T10:00:00Z');

  it('reminds when there is data but never a backup', () => {
    expect(backupReminder('', now, true)).toEqual({ due: true, days: null });
    expect(backupReminder('', now, false)).toEqual({ due: false, days: null });
  });

  it('reminds after 14 days', () => {
    expect(backupReminder('2026-10-07T10:00:00.000Z', now, true)).toEqual({ due: false, days: 13 });
    expect(backupReminder('2026-10-06T10:00:00.000Z', now, true)).toEqual({ due: true, days: 14 });
  });
});

describe('helpers', () => {
  it('round-trips large byte arrays through base64', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('names the file by date', () => {
    expect(backupFileName('2026-10-03')).toBe('manager-backup-2026-10-03.json');
  });
});
