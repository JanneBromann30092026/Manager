import { describe, expect, it } from 'vitest';
import { planApiImport, type ApiDraft } from './apiImport';

const draft = (fields: Partial<ApiDraft>): ApiDraft => ({
  externalId: 'x1',
  date: '2026-09-29',
  platform: 'instagram',
  format: 'reel',
  ...fields,
});

const ids = (plans: ReturnType<typeof planApiImport>) =>
  plans.map((plan) => (plan.kind === 'update' ? plan.target.id : 'new'));

describe('planApiImport', () => {
  it('matches by platform id first', () => {
    const existing = [
      {
        id: 'p1',
        date: '2026-01-01',
        platform: 'instagram' as const,
        topic: undefined,
        externalId: 'x1',
      },
    ];
    expect(ids(planApiImport(existing, [draft({})]))).toEqual(['p1']);
    expect(ids(planApiImport(existing, [draft({ platform: 'youtube' })]))).toEqual(['new']);
  });

  it('takes the only hand-entered post of that day, or the one with the same topic', () => {
    const manual = {
      id: 'p2',
      date: '2026-09-29',
      platform: 'instagram' as const,
      topic: 'Gehalt',
    };
    expect(ids(planApiImport([manual], [draft({ topic: 'Ganz anders' })]))).toEqual(['p2']);
    const other = { id: 'p3', date: '2026-09-29', platform: 'instagram' as const, topic: 'ETF' };
    expect(
      ids(
        planApiImport(
          [manual, other],
          [draft({ externalId: 'a', topic: 'etf' }), draft({ externalId: 'b', topic: 'Neu' })],
        ),
      ),
    ).toEqual(['p3', 'new']);
  });
});
