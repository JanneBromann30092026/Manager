/**
 * "Neues Video": labels, rules, fill-in templates (without AI) and AI prompts per building
 * block (docs/INHALTE.md). Templates are plain text with "…" gaps to fill in.
 */
import type { CtaType, VideoBlockKey, VideoKind, VideoStatus } from '../domain';
import { CTA_TEMPLATES, CUT_LIST_RULES, SCRIPT_RULES, SUBTITLE_RULES } from './content';

export const VIDEO_KIND_LABELS: Record<VideoKind, string> = { reel: 'Reel', podcast: 'Podcast' };

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  idea: 'Idee',
  script: 'Skript',
  filmed: 'Gedreht',
  edited: 'Geschnitten',
  published: 'Veröffentlicht',
};

export interface BlockContext {
  topic: string;
  kind: VideoKind;
  cta: CtaType;
}

interface BlockTemplate {
  label: string;
  /** Short hint what the block is for (and where it is pasted). */
  hint: string;
  rules: readonly string[];
  template: (context: BlockContext) => string;
  /** Task for Claude; the system prompt adds channel profile and rules. */
  prompt: (context: BlockContext) => string;
}

const ctaLine = (cta: CtaType) =>
  `CTA (${CTA_TEMPLATES[cta].label}): „${CTA_TEMPLATES[cta].example}“`;

export const VIDEO_BLOCK_TEMPLATES: Record<VideoBlockKey, BlockTemplate> = {
  script: {
    label: 'Skript',
    hint: 'Zum Ablesen beim Drehen.',
    rules: SCRIPT_RULES,
    template: ({ topic, cta }) =>
      [
        `THEMA: ${topic}`,
        '',
        'HOOKS (Thema in den ersten 2 Sekunden, keine Vorgeschichte)',
        '1. Frage: „…?“',
        '2. Zahl: „…“ (Quelle: …)',
        '3. Widerspruch: „Alle sagen …, aber …“',
        '',
        'HAUPTTEIL',
        '[B-ROLL: …]',
        '…',
        '[MEME: …]',
        '…',
        '',
        'FOLGEN-GRUND',
        '„Folg mir, wenn du … willst.“',
        '',
        ctaLine(cta),
      ].join('\n'),
    prompt: ({ topic, kind, cta }) =>
      [
        `Schreibe das Skript für ein ${kind === 'podcast' ? 'Podcast-Intro' : 'Reel (30–60 Sekunden)'} zum Thema „${topic}“.`,
        'Aufbau: drei alternative Hooks (1. Frage, 2. Zahl, 3. Widerspruch), das Thema in den ersten 2 Sekunden, keine Vorgeschichte.',
        'Danach der Hauptteil in kurzen Sätzen zum Sprechen, mit Markern [MEME: …] und [B-ROLL: …] an passenden Stellen.',
        'Nenne im Video einen Grund zu folgen.',
        `Ende mit diesem CTA-Typ: ${CTA_TEMPLATES[cta].label} (Beispiel: „${CTA_TEMPLATES[cta].example}“).`,
        'Gliedere mit den Überschriften HOOKS, HAUPTTEIL, FOLGEN-GRUND, CTA.',
      ].join('\n'),
  },
  cutList: {
    label: 'Schnittliste (CapCut)',
    hint: 'Zum Abarbeiten in CapCut Pro auf dem iPad.',
    rules: [...CUT_LIST_RULES, ...SUBTITLE_RULES],
    template: () =>
      [
        'ZEIT | BILD | TEXT-OVERLAY | MEME/B-ROLL',
        '0:00–0:02 | Gesicht, Hook | „…“ | –',
        '0:02–0:10 | … | „…“ | [B-ROLL: …]',
        '0:10–0:20 | … | „…“ | [MEME: …]',
        '0:20–0:30 | … | „…“ | –',
        '0:30–0:35 | CTA | „…“ | –',
        '',
        'UNTERTITEL: max. 2–3 Wörter, nie trennen, weiß mit dunkler Kontur, Schlüsselwort Brand-Blau, knapp unter Bildmitte.',
        'MUSIK: ruhig, leise unter der Stimme.',
        'SCHNITT: harte Schnitte.',
      ].join('\n'),
    prompt: ({ topic }) =>
      [
        `Erstelle eine Schnittliste für CapCut Pro (iPad) zum Video „${topic}“, passend zum Skript unten.`,
        'Format pro Zeile: ZEIT | BILD | TEXT-OVERLAY | MEME/B-ROLL. Harte Schnitte.',
        `Untertitel-Regeln: ${SUBTITLE_RULES.join(' ')}`,
        'Am Ende eine Zeile MUSIK (ruhig).',
      ].join('\n'),
  },
  cover: {
    label: 'Cover',
    hint: 'Drei Textvarianten fürs Cover-Studio (Schritt 6).',
    rules: [
      'Maximal 4 Wörter, 2 Zeilen, Großbuchstaben.',
      'Bevorzugt Frage oder Zahl.',
      'Pose passend: Frage → nachdenklich, Zahl → überrascht.',
    ],
    template: () => ['1. …', '2. …', '3. …'].join('\n'),
    prompt: ({ topic }) =>
      [
        `Schreibe drei Cover-Texte für das Video „${topic}“.`,
        'Jeweils maximal 4 Wörter, in Großbuchstaben, auf 2 Zeilen aufteilbar, bevorzugt als Frage oder mit Zahl.',
        'Format: nummerierte Liste 1.–3., sonst nichts.',
      ].join('\n'),
  },
  caption: {
    label: 'Instagram-Caption',
    hint: 'Zum Einfügen bei Instagram.',
    rules: ['Erste Zeile = Hook.', 'CTA am Ende.', 'Hashtags am Schluss (5–8).'],
    template: ({ topic, cta }) =>
      [`${topic} – …`, '', '…', '', CTA_TEMPLATES[cta].example, '', '#finanzen #geld …'].join('\n'),
    prompt: ({ topic, cta }) =>
      [
        `Schreibe die Instagram-Caption zum Reel „${topic}“.`,
        'Erste Zeile als Hook, dann 2–4 kurze Absätze, dann der CTA',
        `(${CTA_TEMPLATES[cta].label}), am Schluss 5–8 passende Hashtags.`,
      ].join(' '),
  },
  youtube: {
    label: 'YouTube',
    hint: 'Titel, Beschreibung, Keywords und Kapitel für YouTube.',
    rules: [
      '3 Titelvarianten.',
      'Beschreibung mit Kapiteln (Zeitstempel).',
      'Keywords kommagetrennt.',
    ],
    template: ({ topic }) =>
      [
        'TITEL',
        `1. ${topic}`,
        '2. …',
        '3. …',
        '',
        'BESCHREIBUNG',
        '…',
        '',
        'KAPITEL',
        '0:00 Intro',
        '0:… …',
        '',
        'KEYWORDS',
        '…',
      ].join('\n'),
    prompt: ({ topic, kind }) =>
      [
        `Erstelle die YouTube-Texte zum ${kind === 'podcast' ? 'Podcast' : 'Short'} „${topic}“:`,
        'TITEL (3 Varianten), BESCHREIBUNG (kurz, mit Hinweis auf Instagram), KAPITEL (Zeitstempel, nur bei Podcast sinnvoll), KEYWORDS (kommagetrennt).',
      ].join(' '),
  },
  communityQuestion: {
    label: 'Kommentar',
    hint: 'Eine Community-Frage für den angepinnten Kommentar.',
    rules: ['Eine Frage, leicht zu beantworten.', 'Lädt zu eigener Erfahrung ein.'],
    template: () => '…?',
    prompt: ({ topic }) =>
      `Schreibe eine Community-Frage für den angepinnten Kommentar unter dem Video „${topic}“. Eine Frage, leicht zu beantworten, lädt zu eigener Erfahrung ein. Nur die Frage.`,
  },
  clips: {
    label: 'Clips (Podcast)',
    hint: '4–6 Clips als Reels/Shorts mit Zeitstempeln und Hook.',
    rules: ['4–6 Clips.', 'Je Clip: Zeitstempel von–bis und ein Hook.'],
    template: () => ['1. 00:00–00:45 · Hook: „…“', '2. …', '3. …', '4. …'].join('\n'),
    prompt: ({ topic }) =>
      [
        `Schlage 4–6 Clips aus der Podcast-Folge „${topic}“ für Reels/Shorts vor.`,
        'Je Clip: Zeitstempel als „[Zeit prüfen]“-Platzhalter, wenn kein Transkript vorliegt, und ein Hook in einem Satz.',
      ].join(' '),
  },
};

/** Blocks shown for a video kind (clips only for podcasts). */
export function blocksFor(kind: VideoKind): VideoBlockKey[] {
  const keys: VideoBlockKey[] = [
    'script',
    'cutList',
    'cover',
    'caption',
    'youtube',
    'communityQuestion',
  ];
  return kind === 'podcast' ? [...keys, 'clips'] : keys;
}

/**
 * Words that make a topic an investment topic: then the video needs the hint "keine
 * Anlageberatung" (rules check before "fertig").
 */
export const INVESTMENT_KEYWORDS = [
  'etf',
  'aktie',
  'aktien',
  'invest',
  'investier',
  'anlage',
  'anlegen',
  'depot',
  'sparplan',
  'krypto',
  'bitcoin',
  'fonds',
  'rendite',
  'börse',
  'dividende',
  'zins',
  'zinsen',
  'festgeld',
  'tagesgeld',
] as const;

export const NO_ADVICE_HINT = 'Keine Anlageberatung.';
