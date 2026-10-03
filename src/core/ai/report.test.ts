import { describe, expect, it } from 'vitest';
import { parseReportAnswer, reportPrompt } from './report';

describe('report AI', () => {
  it('builds the prompt from facts and the rule draft', () => {
    const prompt = reportPrompt({
      week: '2026-W40',
      good: 'Gut',
      bad: 'Schlecht',
      why: 'Warum',
      actions: ['A', 'B', 'C'],
      progress: '109 von 500',
      facts: ['Zeitraum 28.09.2026–04.10.2026'],
    });
    expect(prompt).toContain('- Zeitraum 28.09.2026–04.10.2026');
    expect(prompt).toContain('Maßnahmen: A | B | C');
    expect(prompt).toContain('erfinde keine Zahlen');
  });

  it('parses only complete answers', () => {
    expect(
      parseReportAnswer(
        '```json\n{"good":"g","bad":"b","why":"w","actions":["1","2","3"],"progress":"p"}\n```',
      ),
    ).toEqual({ good: 'g', bad: 'b', why: 'w', actions: ['1', '2', '3'], progress: 'p' });
    expect(parseReportAnswer('{"good":"g"}')).toBeNull();
    expect(parseReportAnswer('nichts')).toBeNull();
  });
});
