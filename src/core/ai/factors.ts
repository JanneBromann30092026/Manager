/** Prompt for „Einflussfaktoren mit Claude erklären“ (plain text answer). */
export function factorsPrompt(facts: readonly string[], videos: string): string {
  return [
    `Erkläre dem Creator kurz, was diese Auswertung seiner ${videos} bedeutet: ehrlich, direkt, du-Form, höchstens 6 Sätze.`,
    'Nutze nur diese Fakten; erfinde keine Zahlen. Es sind Zusammenhänge, keine bewiesenen Ursachen – sag das, wo es zählt.',
    'Bei wenigen Reels oder „unsicher“ markierten Gruppen deutlich mit [unsicher] kennzeichnen.',
    'Schließe mit genau 2 konkreten Tests für die nächsten Videos (je eine Zeile, beginnend mit „Test:“).',
    '',
    '## Fakten',
    ...facts.map((fact) => `- ${fact}`),
  ].join('\n');
}
