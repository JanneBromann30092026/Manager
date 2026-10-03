/**
 * Content templates from docs/INHALTE.md: hook types, CTA rotation, cover and subtitle rules,
 * report outline and the building blocks of a video package.
 */
import type { CtaType, HookType } from '../domain';

export const HOOK_TEMPLATES: Record<HookType, { label: string; hint: string }> = {
  question: { label: 'Frage', hint: 'Eine Frage, die sich die Zielgruppe selbst stellt.' },
  number: { label: 'Zahl', hint: 'Eine konkrete, überraschende Zahl (mit Quelle).' },
  contradiction: { label: 'Widerspruch', hint: 'Widerspricht einer verbreiteten Annahme.' },
  other: { label: 'Andere', hint: 'Sonstiger Einstieg.' },
};

/** The three hooks of every script, in this order. */
export const SCRIPT_HOOK_TYPES: readonly HookType[] = ['question', 'number', 'contradiction'];

/** CTA rotation: share → comment question → follow with a reason, then again from the top. */
export const CTA_ROTATION: readonly CtaType[] = ['share', 'comment', 'follow'];

export const CTA_TEMPLATES: Record<CtaType, { label: string; example: string }> = {
  share: { label: 'Teilen', example: 'Schick das an jemanden, der …' },
  comment: { label: 'Kommentar-Frage', example: 'Wie machst du das? Schreib’s in die Kommentare.' },
  follow: { label: 'Folgen mit Grund', example: 'Folg mir, wenn du … willst.' },
};

export const SCRIPT_RULES = [
  'Thema in den ersten 2 Sekunden, keine Vorgeschichte.',
  'Drei Hooks: Frage, Zahl, Widerspruch.',
  'Hauptteil mit Markern [MEME: …] und [B-ROLL: …].',
  'Folgen-Grund im Video nennen.',
  'CTA nach Rotation.',
] as const;

export const SUBTITLE_RULES = [
  'Maximal 2–3 Wörter pro Untertitel.',
  'Wörter nie trennen.',
  'Weiß mit dunkler Kontur.',
  'Schlüsselwort in Brand-Blau.',
  'Fest knapp unter der Bildmitte.',
] as const;

export const CUT_LIST_RULES = [
  'Timing, Einspieler, Meme-Positionen und Textoverlays angeben.',
  'Harte Schnitte.',
] as const;

export const COVER_RULES = [
  'Blauer Verlauf (dunkel links unten → hell rechts oben), freigestelltes Foto rechts.',
  '2 Zeilen weißer, fetter Text in Großbuchstaben links, maximal 4 Wörter, bevorzugt Frage oder Zahl.',
  'Hellblaue Akzentlinien.',
  'Reel-Cover 1080×1920: Text im mittleren 4:5-Bereich (Profilraster).',
  'YouTube-Thumbnail 1280×720: größeres Gesicht, mehr Kontrast.',
  'Pose passend zum Thema (Frage → nachdenklich, Zahl → überrascht).',
] as const;

export const COVER_SIZES = {
  reel: { width: 1080, height: 1920 },
  thumbnail: { width: 1280, height: 720 },
} as const;

export const COVER_TEXT_LIMITS = { maxWords: 4, maxLines: 2, variants: 3 } as const;

/** Outline of the weekly report (JJJJ-KW). */
export const REPORT_OUTLINE = [
  { key: 'good', label: 'Was lief gut' },
  { key: 'bad', label: 'Was lief schlecht' },
  { key: 'why', label: 'Warum' },
  { key: 'actions', label: '3 Maßnahmen für nächste Woche' },
  { key: 'progress', label: 'Fortschritt zum 500er-Ziel' },
] as const;
