import { describe, expect, it } from 'vitest';
import {
  cleanToken,
  insightsSchema,
  insightValues,
  isReel,
  mediaPageSchema,
  newTokenRecord,
  reelToDraft,
  tokenStatus,
  topicFromCaption,
} from './instagram';

const NOW = new Date('2026-10-03T10:00:00Z');

describe('instagram token', () => {
  it('accepts only Instagram tokens', () => {
    expect(cleanToken(`  "IGAAdemo${'x'.repeat(30)}"  `)).toBe(`IGAAdemo${'x'.repeat(30)}`);
    expect(cleanToken('EAAB-facebook-token')).toBeUndefined();
    expect(cleanToken('IG kurz')).toBeUndefined();
  });

  it('lives 60 days, warns in the last week, refreshes after 24 h', () => {
    const record = newTokenRecord(`IG${'a'.repeat(30)}`, NOW);
    expect(record.expiresAt).toBe('2026-12-02T10:00:00.000Z');
    expect(tokenStatus(record, NOW)).toEqual({
      daysLeft: 60,
      expired: false,
      warn: false,
      canRefresh: false,
    });
    expect(tokenStatus(record, new Date('2026-10-04T11:00:00Z')).canRefresh).toBe(true);
    expect(tokenStatus(record, new Date('2026-11-28T10:00:00Z'))).toMatchObject({
      daysLeft: 4,
      warn: true,
    });
    expect(tokenStatus(record, new Date('2026-12-03T10:00:00Z'))).toMatchObject({
      expired: true,
      canRefresh: false,
      daysLeft: 0,
    });
    expect(newTokenRecord('IGx', NOW, 3600).expiresAt).toBe('2026-10-03T11:00:00.000Z');
  });
});

describe('instagram mapping', () => {
  const [reel, photo] = mediaPageSchema.parse({
    data: [
      {
        id: '1789',
        caption: '#finanzen\nSo teile ich mein Gehalt auf 💸 #geld @demo\nMehr Text',
        media_type: 'VIDEO',
        media_product_type: 'REELS',
        timestamp: '2026-09-29T17:30:00+0000',
      },
      {
        id: '1790',
        media_type: 'IMAGE',
        media_product_type: 'FEED',
        timestamp: '2026-09-30T10:00:00+0000',
      },
    ],
  }).data;

  it('reads lifetime and total values', () => {
    const values = insightValues(
      insightsSchema.parse({
        data: [
          { name: 'views', values: [{ value: 1200 }] },
          { name: 'likes', total_value: { value: 45 } },
          { name: 'saved', values: [{ value: 'x' }] },
        ],
      }),
    );
    expect([...values]).toEqual([
      ['views', 1200],
      ['likes', 45],
    ]);
  });

  it('maps reels; unknown values stay empty, watch time from ms', () => {
    expect(isReel(reel!)).toBe(true);
    expect(isReel(photo!)).toBe(false);
    const draft = reelToDraft(
      reel!,
      new Map([
        ['views', 1200],
        ['saved', 9],
        ['ig_reels_avg_watch_time', 6540],
      ]),
    );
    expect(draft).toMatchObject({
      externalId: '1789',
      platform: 'instagram',
      format: 'reel',
      topic: 'So teile ich mein Gehalt auf 💸',
      views: 1200,
      saves: 9,
      avgWatchSeconds: 6.5,
    });
    expect(draft.newFollowers).toBeUndefined();
    expect(draft.nonFollowerPct).toBeUndefined();
    expect(draft.likes).toBeUndefined();
  });

  it('builds topics from captions', () => {
    expect(topicFromCaption(undefined)).toBeUndefined();
    expect(topicFromCaption('#nur #hashtags')).toBeUndefined();
    expect(topicFromCaption('x'.repeat(200))).toHaveLength(160);
  });
});
