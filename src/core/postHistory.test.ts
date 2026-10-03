import { describe, expect, it } from 'vitest';
import { appendSnapshot, snapshotOf, valueAtAge, type PostSnapshot } from './postHistory';

const at = (hours: number) => new Date(Date.UTC(2026, 9, 1, 18) + hours * 3_600_000).toISOString();
const PUBLISHED = at(0);

describe('post history', () => {
  it('keeps only known values', () => {
    expect(snapshotOf({ views: 10, likes: undefined }, at(1))).toEqual({ at: at(1), views: 10 });
  });

  it('appends sorted, replaces fetches within an hour, skips empty snapshots', () => {
    let history: PostSnapshot[] = [];
    history = appendSnapshot(history, { at: at(5), views: 50 }, 10);
    history = appendSnapshot(history, { at: at(2), views: 20 }, 10);
    history = appendSnapshot(history, { at: at(5.5), views: 55 }, 10);
    history = appendSnapshot(history, { at: at(9) }, 10);
    expect(history.map((entry) => entry.views)).toEqual([20, 55]);
  });

  it('thins out the densest snapshots but keeps first and last', () => {
    let history: PostSnapshot[] = [];
    for (const hours of [0, 2, 4, 6, 24, 72, 168]) {
      history = appendSnapshot(history, { at: at(hours), views: hours }, 4);
    }
    expect(history).toHaveLength(4);
    expect(history[0]!.views).toBe(0);
    expect(history.at(-1)!.views).toBe(168);
    expect(history.map((entry) => entry.views)).toContain(72);
  });

  it('reads the value near a milestone, never interpolated', () => {
    const history = [
      { at: at(20), views: 100 },
      { at: at(30), views: 140 },
      { at: at(170), views: 900 },
    ];
    expect(valueAtAge(history, PUBLISHED, 24)).toBe(100);
    expect(valueAtAge(history, PUBLISHED, 72)).toBeUndefined();
    expect(valueAtAge(history, PUBLISHED, 168)).toBe(900);
    expect(valueAtAge(history, PUBLISHED, 24, 'likes')).toBeUndefined();
    expect(valueAtAge(history, 'kaputt', 24)).toBeUndefined();
  });
});
