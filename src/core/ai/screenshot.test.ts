import { describe, expect, it } from 'vitest';
import { parseScreenshotAnswer, SCREENSHOT_PROMPT } from './screenshot';

describe('parseScreenshotAnswer', () => {
  it('takes only clearly read values and marks them', () => {
    const answer =
      'Hier: {"platform":"instagram","format":"reel","date":"2026-09-28","views":1357.4,"nonFollowerPct":61,"newFollowers":"9","stories":12,"reelsTab":70,"endHoldPct":18,"likes":null,"saves":"viele","explore":150}';
    const { draft, readFields } = parseScreenshotAnswer(answer);
    expect(draft).toEqual({
      platform: 'instagram',
      format: 'reel',
      date: '2026-09-28',
      views: 1357,
      nonFollowerPct: 61,
      newFollowers: 9,
      retention: { endHoldPct: 18, sources: { stories: 12, reelsTab: 70 } },
    });
    expect(readFields.sort()).toEqual(
      ['views', 'nonFollowerPct', 'newFollowers', 'stories', 'reelsTab', 'endHoldPct'].sort(),
    );
  });

  it('returns nothing for answers without JSON', () => {
    expect(parseScreenshotAnswer('Ich kann nichts erkennen.')).toEqual({
      draft: {},
      readFields: [],
    });
    expect(parseScreenshotAnswer('{kaputt')).toEqual({ draft: {}, readFields: [] });
  });

  it('forbids guessing in the prompt', () => {
    expect(SCREENSHOT_PROMPT).toMatch(/Nichts schätzen/);
  });
});
