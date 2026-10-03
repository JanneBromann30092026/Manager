/** Prompt and parsing for „Report mit Claude ausformulieren“. */
import { z } from 'zod';
import type { ReportDraft } from '../report';

export function reportPrompt(draft: ReportDraft): string {
  return [
    `Formuliere den Wochenreport ${draft.week} für den Creator aus: ehrlich, direkt, kurz, du-Form.`,
    'Nutze nur diese Fakten und den Regel-Entwurf; erfinde keine Zahlen. Unsicheres mit [unsicher] kennzeichnen.',
    '',
    '## Fakten',
    ...draft.facts.map((fact) => `- ${fact}`),
    '',
    '## Regel-Entwurf',
    `Was lief gut: ${draft.good}`,
    `Was lief schlecht: ${draft.bad}`,
    `Warum: ${draft.why}`,
    `Maßnahmen: ${draft.actions.join(' | ')}`,
    `Fortschritt: ${draft.progress}`,
    '',
    'Antworte NUR mit JSON: {"good": "…", "bad": "…", "why": "…", "actions": ["…", "…", "…"], "progress": "…"}.',
    'Genau 3 konkrete Maßnahmen für nächste Woche. Fortschritt mit den Zahlen aus den Fakten.',
  ].join('\n');
}

const schema = z.object({
  good: z.string().max(5000),
  bad: z.string().max(5000),
  why: z.string().max(5000),
  actions: z.array(z.string().min(1).max(5000)).min(1).max(3),
  progress: z.string().max(5000),
});

export type ReportTexts = z.output<typeof schema>;

export function parseReportAnswer(answer: string): ReportTexts | null {
  const match = /\{[\s\S]*\}/.exec(answer);
  if (!match) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
