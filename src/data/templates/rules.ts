/**
 * Rules, growth priorities and the conversion checklist from docs/INHALTE.md. Rules and
 * priorities are defaults of the brand record (editable in "Marke"); the AI system prompt
 * always contains the rules.
 */

/** Rules for every text, including AI output. */
export const RULES_DEFAULTS = [
  'Feedback ehrlich und direkt; kurz und knapp.',
  'Keine Anlageberatung: keine Kauf- oder Verkaufsempfehlungen; Hinweis „keine Anlageberatung“, wo nötig.',
  'Fakten, Zahlen, Steuer- und Rechtsinfos nur mit Quelle; Unsicheres kennzeichnen.',
  'Vor jeder Veröffentlichung prüft und bestätigt der Creator – die App veröffentlicht nie selbst.',
] as const;

/**
 * Non-negotiable rules: always part of the AI system prompt, even if the creator edits or
 * deletes the editable rules.
 */
export const CORE_AI_RULES = [
  'Keine Anlageberatung: Gib keine Kauf- oder Verkaufsempfehlungen für einzelne Wertpapiere, Fonds, Kryptowährungen oder Versicherungsprodukte. Füge bei Anlagethemen den Hinweis „Keine Anlageberatung“ ein.',
  'Fakten, Zahlen, Steuer- und Rechtsinfos nur mit Quelle (Name der Quelle und Stand). Wenn du keine sichere Quelle kennst, schreibe „[Quelle prüfen]“.',
  'Kennzeichne Unsicheres ausdrücklich mit „[unsicher]“. Erfinde keine Zahlen, Studien oder Zitate.',
  'Deine Ausgaben sind Entwürfe. Der Creator prüft und bestätigt alles vor der Veröffentlichung.',
] as const;

/** Growth priorities, in this order. */
export const GROWTH_DEFAULTS = [
  'Conversion: Folgen-Grund, Bio, Highlights „Start hier“, „Mein Geld“, „Q&A“.',
  'Persönliche Erfahrungs-Themen statt Lexikon.',
  'Serien (z. B. „Finanzbruder erklärt“, Mythen-Check, Geldfehler mit 20).',
  'Q&A-Stories regelmäßig, Fragen als Reels.',
  'Podcast-Clips konsequent verwerten.',
] as const;

export const CONVERSION_KEYS = [
  'bio',
  'highlightStart',
  'highlightMoney',
  'highlightQa',
  'pinned',
] as const;
export type ConversionKey = (typeof CONVERSION_KEYS)[number];

/** Conversion checklist (growth priority 1). */
export const CONVERSION_CHECKLIST: readonly { key: ConversionKey; label: string; hint: string }[] =
  [
    {
      key: 'bio',
      label: 'Bio mit klarem Folgen-Grund',
      hint: 'Was ich lerne, hinterfrage & selbst umsetze.',
    },
    {
      key: 'highlightStart',
      label: 'Highlight „Start hier“',
      hint: 'Wer du bist, was man hier bekommt.',
    },
    {
      key: 'highlightMoney',
      label: 'Highlight „Mein Geld“',
      hint: 'Wie du dein Geld aufteilst und anlegst.',
    },
    { key: 'highlightQa', label: 'Highlight „Q&A“', hint: 'Antworten auf Community-Fragen.' },
    {
      key: 'pinned',
      label: 'Beste Reels angepinnt',
      hint: 'Die drei stärksten Reels oben im Profil.',
    },
  ];

/** Poses of the cut-out photo; the cover picks one by hook type. */
export const POSE_MOODS = ['neutral', 'thoughtful', 'surprised', 'happy', 'pointing'] as const;
export type PoseMood = (typeof POSE_MOODS)[number];

export const POSE_LABELS: Record<PoseMood, string> = {
  neutral: 'Neutral',
  thoughtful: 'Nachdenklich',
  surprised: 'Überrascht',
  happy: 'Freudig',
  pointing: 'Zeigend',
};
