import { describe, expect, it } from 'vitest';
import { checkVideo, isInvestmentTopic, localDate, withStatus } from './videos';

const ok = (items: ReturnType<typeof checkVideo>) =>
  Object.fromEntries(items.map((item) => [item.key, item.ok]));

describe('checkVideo', () => {
  it('flags an empty template', () => {
    const script = [
      'HOOKS',
      '1. Frage: „…?“',
      'HAUPTTEIL',
      '…',
      'FOLGEN-GRUND',
      '„Folg mir, wenn du … willst.“',
    ].join('\n');
    expect(ok(checkVideo({ topic: 'Mein Gehalt', blocks: { script }, cta: undefined }))).toEqual({
      hook: false,
      followReason: true,
      cta: false,
      gaps: false,
    });
  });

  it('passes a finished script', () => {
    const script = [
      'HOOKS',
      '1. Frage: „Wohin geht dein Gehalt am Monatsende?“',
      'HAUPTTEIL',
      'Ich teile mein Gehalt in drei Töpfe.',
      'Folg mir für mehr ehrliche Geld-Tipps.',
    ].join('\n');
    const items = checkVideo({
      topic: 'So teile ich mein Gehalt auf',
      blocks: { script },
      cta: 'share',
    });
    expect(items.every((item) => item.ok)).toBe(true);
    expect(items.map((item) => item.key)).not.toContain('noAdvice');
  });

  it('asks for the no-advice hint on investment topics and sources for numbers', () => {
    const script = 'HOOKS\n1. Zahl: „Der MSCI World brachte 7 % pro Jahr.“\nFolg mir.';
    const items = ok(
      checkVideo({ topic: 'So investiere ich in ETFs', blocks: { script }, cta: 'follow' }),
    );
    expect(items.noAdvice).toBe(false);
    expect(items.sources).toBe(false);
    const fixed = `${script}\nQuelle: MSCI, Stand 09/2026\nKeine Anlageberatung.`;
    const after = ok(
      checkVideo({ topic: 'So investiere ich in ETFs', blocks: { script: fixed }, cta: 'follow' }),
    );
    expect(after.noAdvice).toBe(true);
    expect(after.sources).toBe(true);
  });

  it('accepts the hint in the caption', () => {
    const items = ok(
      checkVideo({
        topic: 'Festgeld oder Tagesgeld?',
        blocks: { script: 'x', caption: 'Keine Anlageberatung.' },
        cta: 'share',
      }),
    );
    expect(items.noAdvice).toBe(true);
  });
});

describe('helpers', () => {
  it('detects investment topics', () => {
    expect(isInvestmentTopic('Aktien für Anfänger')).toBe(true);
    expect(isInvestmentTopic('Meine Krypto-Fehler')).toBe(true);
    expect(isInvestmentTopic('3 Geldfehler in deinen 20ern')).toBe(false);
  });

  it('appends status changes once', () => {
    const start = { status: 'idea' as const, statusHistory: [] };
    const a = withStatus(start, 'idea', '2026-10-02T10:00:00.000Z');
    expect(a.statusHistory).toHaveLength(1);
    const b = withStatus(a, 'script', '2026-10-02T11:00:00.000Z');
    expect(b).toEqual({
      status: 'script',
      statusHistory: [
        { status: 'idea', at: '2026-10-02T10:00:00.000Z' },
        { status: 'script', at: '2026-10-02T11:00:00.000Z' },
      ],
    });
    expect(withStatus(b, 'script', '2026-10-02T12:00:00.000Z')).toBe(b);
  });

  it('formats local dates', () => {
    expect(localDate(new Date(2026, 9, 2, 23, 30))).toBe('2026-10-02');
  });
});
