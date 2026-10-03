import { describe, expect, it } from 'vitest';
import { ideaSchema, videoSchema, type Idea, type PlanItem, type Video } from '@/data/schemas';
import { PLAN_DEFAULT_MINUTES, PLAN_KIND_LABELS, PLAN_TEXTS } from '@/data/templates/plan';
import {
  formatMinutes,
  planEvents,
  plannedElsewhere,
  reelCandidates,
  suggestPlan,
  summarizePlan,
  weekDays,
} from './plan';

let counter = 0;
const nextId = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};
const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 0, minute)).toISOString();

function idea(fields: Partial<Idea>): Idea {
  const id = nextId();
  return ideaSchema.parse({
    id,
    title: `Idee ${id.slice(-3)}`,
    createdAt: at(counter),
    updatedAt: at(counter),
    ...fields,
  });
}

function video(fields: Partial<Video>): Video {
  const id = nextId();
  return videoSchema.parse({
    id,
    date: '2026-10-01',
    topic: `Video ${id.slice(-3)}`,
    createdAt: at(counter),
    updatedAt: at(counter),
    ...fields,
  });
}

const base = {
  week: '2026-W41',
  budgetMinutes: 240,
  durations: PLAN_DEFAULT_MINUTES,
  reelsTarget: 2,
  newId: nextId,
};

describe('weekDays', () => {
  it('lists Monday to Sunday', () => {
    expect(weekDays('2026-W41')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });
});

describe('suggestPlan', () => {
  it('fits Q&A, two reels and a story into 4 hours, community questions first', () => {
    const own = idea({ title: 'Mein Budget', personal: true });
    const community = idea({ title: 'Lohnt sich Festgeld?', source: 'community' });
    const plain = idea({ title: 'Was ist ein ETF?' });
    const { items, skipped } = suggestPlan({ ...base, ideas: [plain, own, community], videos: [] });
    expect(items.map((item) => [item.date, item.kind, item.minutes])).toEqual([
      ['2026-10-05', 'story', 10],
      ['2026-10-06', 'reel', 100],
      ['2026-10-07', 'qa', 20],
      ['2026-10-08', 'reel', 100],
      ['2026-10-09', 'story', 10],
    ]);
    expect(items.find((item) => item.date === '2026-10-06')?.ideaId).toBe(community.id);
    expect(items.find((item) => item.date === '2026-10-08')?.ideaId).toBe(own.id);
    expect(summarizePlan(items, 240).used).toBe(240);
    expect(skipped).toBe(0);
  });

  it('always plans the Q&A story, even without ideas', () => {
    const { items } = suggestPlan({ ...base, ideas: [], videos: [] });
    expect(items.map((item) => item.kind)).toEqual(['story', 'qa', 'story', 'story']);
    expect(items.find((item) => item.kind === 'qa')?.title).toBe(PLAN_TEXTS.qaTitle);
  });

  it('finishes started videos first and counts only the remaining work', () => {
    const fresh = idea({ source: 'community' });
    const filmed = video({ topic: 'Notgroschen', status: 'filmed' });
    const done = video({ status: 'published' });
    const { items } = suggestPlan({ ...base, ideas: [fresh], videos: [done, filmed] });
    const reels = items.filter((item) => item.kind === 'reel');
    expect(reels[0]).toMatchObject({
      videoId: filmed.id,
      minutes: 40,
      title: 'Schneiden & veröffentlichen: Notgroschen',
    });
    expect(reels[1]?.ideaId).toBe(fresh.id);
  });

  it('respects the budget and reports topics that did not fit', () => {
    const { items, skipped } = suggestPlan({
      ...base,
      budgetMinutes: 150,
      ideas: [idea({}), idea({})],
      videos: [],
    });
    expect(items.filter((item) => item.kind === 'reel')).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(summarizePlan(items, 150).used).toBeLessThanOrEqual(150);
  });

  it('skips ideas with a video, done ideas and ideas planned elsewhere', () => {
    const linked = idea({});
    const withVideo = video({ ideaId: linked.id, status: 'idea' });
    const filmed = idea({ status: 'filmed' });
    const elsewhere = idea({});
    const candidates = reelCandidates({
      ideas: [linked, filmed, elsewhere],
      videos: [withVideo],
      durations: PLAN_DEFAULT_MINUTES,
      excludeIds: new Set([elsewhere.id]),
    });
    expect(candidates.map((c) => c.videoId ?? c.ideaId)).toEqual([withVideo.id]);
  });

  it('uses podcast time for podcast videos', () => {
    const podcast = video({ kind: 'podcast', status: 'script' });
    const [first] = reelCandidates({
      ideas: [],
      videos: [podcast],
      durations: PLAN_DEFAULT_MINUTES,
    });
    expect(first).toMatchObject({ kind: 'podcast', minutes: 96 });
  });
});

describe('summarizePlan', () => {
  const item = (fields: Partial<PlanItem>): PlanItem => ({
    id: nextId(),
    date: '2026-10-05',
    kind: 'story',
    title: 'x',
    minutes: 10,
    done: false,
    ...fields,
  });

  it('warns about a missing Q&A, missing reel and an exceeded budget', () => {
    const summary = summarizePlan([item({ minutes: 300, done: true })], 240);
    expect(summary.warnings).toEqual(['noQa', 'noReel', 'overBudget']);
    expect(summary.remaining).toBe(-60);
    expect(summary.done).toBe(1);
  });

  it('builds calendar events only for open tasks', () => {
    const open = item({ kind: 'qa', title: 'Q&A' });
    const events = planEvents(
      [item({ done: true }), open],
      PLAN_KIND_LABELS,
      PLAN_TEXTS.calendarDescription,
    );
    expect(events).toEqual([
      {
        uid: open.id,
        date: '2026-10-05',
        summary: 'Q&A',
        description: 'Q&A-Story · ca. 10 Min. · aus dem Manager-Wochenplan',
      },
    ]);
  });

  it('collects ideas and videos planned in other current or future weeks', () => {
    const a = item({ ideaId: nextId() });
    const b = item({ videoId: nextId() });
    const c = item({ ideaId: nextId() });
    const ids = plannedElsewhere(
      [
        { week: '2026-W40', items: [c] },
        { week: '2026-W41', items: [a] },
        { week: '2026-W42', items: [b] },
      ],
      '2026-W41',
      '2026-W40',
    );
    expect([...ids]).toEqual([c.ideaId, b.videoId]);
    expect(plannedElsewhere([{ week: '2026-W39', items: [c] }], '2026-W41', '2026-W40').size).toBe(
      0,
    );
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 Min.');
    expect(formatMinutes(240)).toBe('4 Std.');
    expect(formatMinutes(200)).toBe('3 Std. 20 Min.');
    expect(formatMinutes(-30)).toBe('−30 Min.');
  });
});
