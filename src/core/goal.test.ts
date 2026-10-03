import { describe, expect, it } from 'vitest';
import { goalProgress } from './goal';
import type { PostNumbers } from './metrics';

const base = { target: 500, deadline: '2026-12-31', posts: [] as PostNumbers[] };

describe('goalProgress', () => {
  it('uses the 30-day insight value when there is no follower history', () => {
    const goal = goalProgress({
      ...base,
      today: '2026-09-28',
      snapshots: [{ date: '2026-09-28', followers: 109, newFollowers30d: 45 }],
    });
    expect(goal.current).toBe(109);
    expect(goal.remaining).toBe(391);
    expect(goal.weeksLeft).toBe(13.4);
    expect(goal.neededPerWeek).toBe(29.1);
    expect(goal.pacePerWeek).toBe(10.5);
    expect(goal.paceSource).toBe('insights');
    expect(goal.status).toBe('behind');
    expect(goal.projected).toBe(250);
  });

  it('prefers the follower history of about 4 weeks', () => {
    const goal = goalProgress({
      ...base,
      today: '2026-10-26',
      snapshots: [
        { date: '2026-09-28', followers: 109 },
        { date: '2026-10-05', followers: 140 },
        { date: '2026-10-26', followers: 249 },
      ],
    });
    expect(goal.paceSource).toBe('snapshots');
    expect(goal.pacePerWeek).toBe(35);
    expect(goal.status).toBe('onTrack');
    expect(goal.asOf).toBe('2026-10-26');
  });

  it('falls back to the new followers of the posts', () => {
    const goal = goalProgress({
      ...base,
      today: '2026-10-03',
      snapshots: [{ date: '2026-10-01', followers: 120 }],
      posts: [
        {
          id: 'a',
          date: '2026-09-20',
          platform: 'instagram',
          format: 'reel',
          measuredAt: '',
          newFollowers: 20,
        },
        {
          id: 'b',
          date: '2026-08-01',
          platform: 'instagram',
          format: 'reel',
          measuredAt: '',
          newFollowers: 99,
        },
      ],
    });
    expect(goal.paceSource).toBe('posts');
    expect(goal.pacePerWeek).toBe(5);
  });

  it('is unknown without numbers and reached at the target', () => {
    expect(goalProgress({ ...base, today: '2026-10-03', snapshots: [] }).status).toBe('unknown');
    const reached = goalProgress({
      ...base,
      today: '2026-10-03',
      snapshots: [{ date: '2026-10-03', followers: 512 }],
    });
    expect(reached.status).toBe('reached');
    expect(reached.fraction).toBe(1);
  });

  it('is behind after the deadline', () => {
    const late = goalProgress({
      ...base,
      today: '2027-01-05',
      snapshots: [{ date: '2027-01-01', followers: 300 }],
    });
    expect(late.weeksLeft).toBe(0);
    expect(late.status).toBe('behind');
  });
});
