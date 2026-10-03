import { describe, expect, it } from 'vitest';
import {
  importPostsCsv,
  knownValues,
  parseCsv,
  parseDate,
  parseNumber,
  planImport,
  recognizeColumns,
} from './csvImport';

describe('CSV basics', () => {
  it('detects the delimiter and handles quotes', () => {
    expect(parseCsv('a;b\n"x;1";"say ""hi"""\r\n\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'say "hi"'],
    ]);
    expect(parseCsv('﻿a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n"line\nbreak"\t2')).toEqual([
      ['a', 'b'],
      ['line\nbreak', '2'],
    ]);
  });

  it('reads German and English numbers, never guesses', () => {
    expect(parseNumber('1.357')).toBe(1357);
    expect(parseNumber('9.190')).toBe(9190);
    expect(parseNumber('4,9')).toBe(4.9);
    expect(parseNumber('0,5 %')).toBe(0.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('53 %')).toBe(53);
    expect(parseNumber('12 s')).toBe(12);
    expect(parseNumber('0:45')).toBe(45);
    expect(parseNumber('–')).toBeUndefined();
    expect(parseNumber('viel')).toBeUndefined();
  });

  it('reads dates', () => {
    expect(parseDate('2026-09-28')).toBe('2026-09-28');
    expect(parseDate('28.09.2026')).toBe('2026-09-28');
    expect(parseDate('1.10.26')).toBe('2026-10-01');
    expect(parseDate('31.02.2026')).toBeUndefined();
    expect(parseDate('gestern')).toBeUndefined();
  });

  it('recognizes column names in German and English', () => {
    expect(
      recognizeColumns([
        'Datum',
        'Plattform',
        'Thema',
        'Aufrufe',
        'Nicht-Follower (%)',
        'Neue Follower',
        'Sek. bis 50 %',
        'Reels-Tab',
        'Foo',
      ]),
    ).toEqual([
      'date',
      'platform',
      'topic',
      'views',
      'nonFollowerPct',
      'newFollowers',
      'halfGoneSeconds',
      'reelsTab',
      undefined,
    ]);
  });
});

describe('importPostsCsv', () => {
  it('turns rows into post drafts and reports problems per line', () => {
    const csv = [
      'Datum;Plattform;Format;Thema;Hook;Aufrufe;Nicht-Follower %;Likes;Neue Follower;Spalte X',
      '28.09.2026;Instagram;Reel;So teile ich mein Geld auf;Frage;1.357;61;80;9;egal',
      '29.09.2026;YT;Short;Inflation;Zahl;894;;12;–;',
      'irgendwann;Instagram;Reel;Kaputt;;1;;;;',
      '30.09.2026;;;Ohne Plattform;Meme;abc;150;;;',
    ].join('\n');
    const result = importPostsCsv(csv);
    expect(result.unknownColumns).toEqual(['Spalte X']);
    expect(result.drafts).toHaveLength(3);
    expect(result.drafts[0]!.draft).toEqual({
      date: '2026-09-28',
      platform: 'instagram',
      format: 'reel',
      topic: 'So teile ich mein Geld auf',
      hookType: 'question',
      views: 1357,
      nonFollowerPct: 61,
      likes: 80,
      newFollowers: 9,
    });
    expect(result.drafts[1]!.draft).toMatchObject({
      platform: 'youtube',
      format: 'short',
      hookType: 'number',
    });
    expect(result.drafts[1]!.draft.newFollowers).toBeUndefined();
    expect(result.drafts[2]!.draft).toMatchObject({
      platform: 'instagram',
      format: 'reel',
      hookType: 'other',
    });
    expect(result.errors).toEqual([
      { line: 4, code: 'date' },
      { line: 5, code: 'value', column: 'views' },
      { line: 5, code: 'value', column: 'nonFollowerPct' },
    ]);
  });

  it('reads retention and traffic sources', () => {
    const csv =
      'Datum,Thema,Länge,Sek bis 50,Halten am Ende,Stories,Reels-Tab,Feed,Profil,Explore\n2026-09-28,Intro,42,"6,5",18,10,55,20,10,5';
    const [row] = importPostsCsv(csv).drafts;
    expect(row!.draft.retention).toEqual({
      lengthSeconds: 42,
      halfGoneSeconds: 6.5,
      endHoldPct: 18,
      sources: { stories: 10, reelsTab: 55, feed: 20, profile: 10, explore: 5 },
    });
  });
});

describe('planImport', () => {
  const existing = [
    {
      id: 'p1',
      date: '2026-09-28',
      platform: 'instagram' as const,
      topic: 'So teile ich mein Geld auf',
    },
    { id: 'p2', date: '2026-09-29', platform: 'instagram' as const },
  ];

  it('updates matching posts and creates new ones; retention rows join their post', () => {
    const plans = planImport(existing, [
      {
        date: '2026-09-28',
        platform: 'instagram',
        format: 'reel',
        topic: 'so teile ich mein geld auf',
        views: 1400,
      },
      { date: '2026-09-29', platform: 'instagram', format: 'reel', retention: { endHoldPct: 20 } },
      { date: '2026-10-01', platform: 'instagram', format: 'reel', topic: 'Neu', views: 10 },
      {
        date: '2026-10-01',
        platform: 'instagram',
        format: 'reel',
        topic: 'Neu',
        retention: { lengthSeconds: 30 },
      },
    ]);
    expect(
      plans.map((plan) => (plan.kind === 'update' ? `update ${plan.target.id}` : 'create')),
    ).toEqual(['update p1', 'update p2', 'create']);
    expect(plans[2]!.draft).toMatchObject({ views: 10, retention: { lengthSeconds: 30 } });
  });

  it('never overwrites known values with unknown ones', () => {
    expect(
      knownValues(
        {
          date: '2026-09-28',
          platform: 'instagram',
          format: 'reel',
          retention: { sources: { feed: 5 } },
        },
        { retention: { endHoldPct: 20, sources: { stories: 10 } } },
      ),
    ).toEqual({
      date: '2026-09-28',
      platform: 'instagram',
      format: 'reel',
      retention: { endHoldPct: 20, sources: { stories: 10, feed: 5 } },
    });
  });
});
