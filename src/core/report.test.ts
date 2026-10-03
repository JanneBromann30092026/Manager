import { describe, expect, it } from 'vitest';
import { goalProgress } from './goal';
import type { PostNumbers } from './metrics';
import { buildWeeklyReport, progressText, reportToMarkdown } from './report';

const post = (fields: Partial<PostNumbers> & { id: string }): PostNumbers => ({
  date: '2026-09-29',
  platform: 'instagram',
  format: 'reel',
  measuredAt: '2026-10-03T10:00:00.000Z',
  ...fields,
});

const goal = goalProgress({
  target: 500,
  deadline: '2026-12-31',
  today: '2026-10-03',
  snapshots: [{ date: '2026-09-28', followers: 109, newFollowers30d: 45 }],
  posts: [],
});

describe('buildWeeklyReport', () => {
  it('names best and worst post, explains and gives exactly three measures', () => {
    const report = buildWeeklyReport({
      week: '2026-W40',
      goal,
      baselineRate: 4.9,
      posts: [
        post({
          id: 'a',
          topic: 'So teile ich mein Geld auf',
          views: 1000,
          newFollowers: 9,
          nonFollowerPct: 30,
          shares: 4,
        }),
        post({
          id: 'b',
          topic: 'Inflation',
          date: '2026-10-01',
          views: 1000,
          newFollowers: 1,
          nonFollowerPct: 34,
        }),
        post({ id: 'c', date: '2026-10-05', views: 99999, newFollowers: 999 }),
      ],
    });
    expect(report.good).toContain('„So teile ich mein Geld auf“ mit 9 neuen Followern');
    expect(report.bad).toContain('„Inflation“ mit 1 pro 1.000');
    expect(report.good).toContain('besser als der Schnitt');
    expect(report.bad).toContain('32 % Nicht-Follower');
    expect(report.actions).toHaveLength(3);
    expect(report.actions[0]).toMatch(/Hooks schärfen/);
    expect(report.facts).toContain('Neue Follower pro 1.000 Aufrufe: 5');
    expect(report.progress).toMatch(/109 von 500 Followern \(Stand 28.09.2026\)/);
    expect(report.progress).toMatch(/verfehlt/);
  });

  it('handles an empty week and early numbers', () => {
    const empty = buildWeeklyReport({ week: '2026-W41', goal, posts: [] });
    expect(empty.bad).toMatch(/nichts veröffentlicht/);
    expect(empty.actions).toHaveLength(3);
    const early = buildWeeklyReport({
      week: '2026-W40',
      goal,
      posts: [
        post({
          id: 'x',
          date: '2026-10-03',
          measuredAt: new Date(2026, 9, 3, 12).toISOString(),
          views: 50,
        }),
      ],
    });
    expect(early.why).toMatch(/zu früh/);
    expect(early.why).toMatch(/fehlen Aufrufe oder neue Follower/);
  });

  it('says honestly when there is no follower count', () => {
    const unknown = goalProgress({
      target: 500,
      deadline: '2026-12-31',
      today: '2026-10-03',
      snapshots: [],
      posts: [],
    });
    expect(progressText(unknown)).toMatch(/Kein Followerstand/);
  });

  it('exports Markdown', () => {
    const md = reportToMarkdown(
      { week: '2026-W40', good: 'Gut', actions: ['Eins', 'Zwei', 'Drei'], progress: 'Weiter' },
      ['Fakt'],
    );
    expect(md).toContain('# Wochenreport 2026-W40');
    expect(md).toContain('- Fakt');
    expect(md).toContain('## Was lief gut\n\nGut');
    expect(md).toContain('## Was lief schlecht\n\n–');
    expect(md).toContain('1. Eins\n2. Zwei\n3. Drei');
  });
});
