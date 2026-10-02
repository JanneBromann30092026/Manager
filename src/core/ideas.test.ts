import { describe, expect, it } from 'vitest';
import type { Idea } from '@/data/schemas';
import {
  filterIdeas,
  ideaScore,
  looksPersonal,
  nextIdeaStatus,
  parseBulkIdeas,
  seriesOptions,
  sortIdeas,
} from './ideas';

let counter = 0;
function idea(fields: Partial<Idea>): Idea {
  counter += 1;
  const at = new Date(Date.UTC(2026, 9, 1, 0, counter)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    title: `Idee ${counter}`,
    source: 'own',
    series: undefined,
    notes: undefined,
    personal: false,
    status: 'idea',
    demo: false,
    createdAt: at,
    updatedAt: at,
    ...fields,
  };
}

describe('parseBulkIdeas', () => {
  it('takes one idea per line, strips list markers and duplicates', () => {
    const text = [
      '- Lohnt sich ein Bausparvertrag?',
      '• ETF oder Festgeld?',
      '',
      '2) Wie viel sparen mit 20?',
      'Q: Lohnt sich ein   Bausparvertrag?',
      '   ',
      'Frage: Was ist ein Notgroschen?',
    ].join('\r\n');
    expect(parseBulkIdeas(text)).toEqual([
      'Lohnt sich ein Bausparvertrag?',
      'ETF oder Festgeld?',
      'Wie viel sparen mit 20?',
      'Was ist ein Notgroschen?',
    ]);
  });

  it('caps length and count', () => {
    expect(parseBulkIdeas('x'.repeat(300))[0]).toHaveLength(160);
    const many = Array.from({ length: 80 }, (_, i) => `Frage ${i}`).join('\n');
    expect(parseBulkIdeas(many)).toHaveLength(50);
  });
});

describe('looksPersonal', () => {
  it('detects first-person topics', () => {
    expect(looksPersonal('So teile ich mein Geld auf')).toBe(true);
    expect(looksPersonal('Meine größten Geldfehler')).toBe(true);
    expect(looksPersonal('Inflation einfach erklärt')).toBe(false);
    expect(looksPersonal('Michael erklärt ETFs')).toBe(false);
  });
});

describe('priority and filters', () => {
  it('ranks community questions, personal topics and series first, done ideas last', () => {
    const lexicon = idea({ title: 'Was ist Inflation?' });
    const series = idea({ series: 'Mythen-Check' });
    const personal = idea({ personal: true });
    const community = idea({ source: 'community' });
    const published = idea({ source: 'community', personal: true, status: 'published' });
    const planned = idea({ status: 'planned' });
    expect(ideaScore(community)).toBeGreaterThan(ideaScore(personal));
    expect(sortIdeas([lexicon, published, series, personal, planned, community])).toEqual([
      community,
      personal,
      series,
      planned,
      lexicon,
      published,
    ]);
  });

  it('filters by status, source, series and text', () => {
    const a = idea({ title: 'Bausparvertrag', source: 'community' });
    const b = idea({ title: 'ETF', series: 'Mythen-Check', status: 'filmed' });
    const c = idea({ title: 'Notgroschen', notes: 'Tagesgeld', status: 'published' });
    const all = [a, b, c];
    expect(filterIdeas(all, { status: 'open' })).toEqual([a]);
    expect(filterIdeas(all, { status: 'filmed' })).toEqual([b]);
    expect(filterIdeas(all, { source: 'community' })).toEqual([a]);
    expect(filterIdeas(all, { series: 'Mythen-Check' })).toEqual([b]);
    expect(filterIdeas(all, { query: 'tagesGELD' })).toEqual([c]);
    expect(filterIdeas(all, {})).toEqual(all);
  });

  it('lists series and the next status', () => {
    expect(seriesOptions([idea({ series: 'Zeta' }), idea({})], ['Alpha'])).toEqual([
      'Alpha',
      'Zeta',
    ]);
    expect(nextIdeaStatus('idea')).toBe('planned');
    expect(nextIdeaStatus('filmed')).toBe('published');
    expect(nextIdeaStatus('published')).toBeNull();
  });
});
