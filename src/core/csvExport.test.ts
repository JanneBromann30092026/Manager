import { describe, expect, it } from 'vitest';
import { postSchema, accountStatSchema } from '@/data/schemas';
import { csvCell, followersToCsv, postsToCsv } from './csvExport';
import { importPostsCsv } from './csvImport';

const base = {
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
  measuredAt: '2026-10-02T10:00:00.000Z',
};

const posts = [
  postSchema.parse({
    ...base,
    id: '7f1e8a52-3c4b-4d5e-8f60-718293a4b5c6',
    date: '2026-10-01',
    platform: 'instagram',
    format: 'reel',
    topic: 'Budget; "50/30/20"',
    hookType: 'question',
    views: 2400,
    nonFollowerPct: 61.5,
    avgWatchSeconds: 7.3,
    newFollowers: 6,
    retention: { lengthSeconds: 32, sources: { reelsTab: 70 } },
  }),
  postSchema.parse({
    ...base,
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    date: '2026-09-28',
    platform: 'youtube',
    format: 'short',
    topic: '=SUMME(A1)',
  }),
];

describe('postsToCsv', () => {
  it('writes German CSV (BOM, ";" and decimal comma), oldest first, empty unknowns', () => {
    const csv = postsToCsv(posts);
    expect(csv.startsWith('﻿Datum;Plattform;Format;Thema;Hook;Aufrufe')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^2026-09-28;youtube;short;'=SUMME\(A1\);;;;/);
    expect(lines[2]).toContain('"Budget; ""50/30/20"""');
    expect(lines[2]).toContain(';Frage;2400;61,5;7,3;');
    // 6 / 2400 × 1000 = 2.5
    expect(lines[2]).toContain(';6;2,5;32;');
  });

  it('can be imported again with the same numbers', () => {
    const result = importPostsCsv(postsToCsv(posts));
    expect(result.errors).toEqual([]);
    expect(result.unknownColumns).toEqual(['Follower pro 1.000 Aufrufe', 'Stand', 'Quelle']);
    const reel = result.drafts.find((row) => row.draft.platform === 'instagram')?.draft;
    expect(reel).toMatchObject({
      date: '2026-10-01',
      format: 'reel',
      topic: 'Budget; "50/30/20"',
      hookType: 'question',
      views: 2400,
      nonFollowerPct: 61.5,
      avgWatchSeconds: 7.3,
      newFollowers: 6,
    });
    expect(reel?.retention?.lengthSeconds).toBe(32);
    expect(reel?.retention?.sources?.reelsTab).toBe(70);
  });
});

describe('followersToCsv', () => {
  it('lists follower counts by date', () => {
    const csv = followersToCsv([
      accountStatSchema.parse({
        ...base,
        id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        date: '2026-09-28',
        followers: 84,
      }),
    ]);
    expect(csv.trim().split('\r\n')[1]).toBe('2026-09-28;instagram;84;;;;;manual;');
  });
});

describe('csvCell', () => {
  it('defuses formulas and quotes separators', () => {
    expect(csvCell('+49 123')).toBe("'+49 123");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('normal')).toBe('normal');
  });
});
