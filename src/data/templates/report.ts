/** Texts of the rule-based weekly report (report content, kept as data). */
import { REPORT_OUTLINE } from './content';

const outline = Object.fromEntries(REPORT_OUTLINE.map((item) => [item.key, item.label])) as Record<
  (typeof REPORT_OUTLINE)[number]['key'],
  string
>;

const day = (date: string) => date.split('-').reverse().join('.');

export const REPORT_TEXTS = {
  mdTitle: (week: string) => `Wochenreport ${week}`,
  mdGood: outline.good,
  mdBad: outline.bad,
  mdWhy: outline.why,
  mdActions: outline.actions,
  mdProgress: outline.progress,
  period: (start: string, end: string) => `Zeitraum ${day(start)}–${day(end)}`,
  untitled: (date: string) => `Beitrag vom ${day(date)}`,
  factTotals: (posts: number, views: string, followers: string) =>
    `${posts} Beitr${posts === 1 ? 'ag' : 'äge'}, ${views} Aufrufe, ${followers} neue Follower`,
  factRate: (rate: string) => `Neue Follower pro 1.000 Aufrufe: ${rate}`,
  factNonFollower: (pct: string) => `Nicht-Follower im Schnitt: ${pct} %`,
  factEarly: (count: number) =>
    `${count} Beitr${count === 1 ? 'ag' : 'äge'} mit Zahlen unter 24 Stunden (zu früh)`,
  noPosts: 'Diese Woche wurde nichts veröffentlicht.',
  noPostsWhy: 'Ohne Beitrag keine Reichweite und keine neuen Follower.',
  best: (label: string, rate: string, views: string) =>
    `Bester Beitrag: ${label} mit ${rate} neuen Followern pro 1.000 Aufrufe (${views} Aufrufe).`,
  worst: (label: string, rate: string, views: string) =>
    `Schwächster Beitrag: ${label} mit ${rate} pro 1.000 Aufrufe (${views} Aufrufe).`,
  rateUp: (rate: string, base: string) =>
    `Hauptkennzahl ${rate} pro 1.000 Aufrufe – besser als der Schnitt der 4 Wochen davor (${base}).`,
  rateDown: (rate: string, base: string) =>
    `Hauptkennzahl ${rate} pro 1.000 Aufrufe – schlechter als der Schnitt der 4 Wochen davor (${base}).`,
  lowReach: (pct: string) => `Nur ${pct} % Nicht-Follower: Die Beiträge erreichen kaum neue Leute.`,
  lowReachWhy: 'Wenig Nicht-Follower heißt meist: Der Hook stoppt Fremde nicht schnell genug.',
  goodReach: (pct: string) => `${pct} % Nicht-Follower: Die Beiträge erreichen neue Leute.`,
  lowConversionWhy:
    'Unter 5 neuen Followern pro 1.000 Aufrufe: Der Grund zu folgen ist im Video nicht klar genug.',
  sharesSaves: (shares: number, saves: number) =>
    `${shares}× geteilt und ${saves}× gespeichert – Zeichen für nützlichen Inhalt.`,
  bestWhy: (label: string) =>
    `${label} hat am besten konvertiert – Thema und Hook-Typ als Vorlage für die nächsten Videos nehmen.`,
  earlyWhy: (count: number) =>
    `${count} Beitr${count === 1 ? 'ag ist' : 'äge sind'} jünger als 24 Stunden – die Zahlen sind noch zu früh.`,
  missingValues: (count: number) =>
    `Bei ${count} Beitr${count === 1 ? 'ag' : 'ägen'} fehlen Aufrufe oder neue Follower – sie zählen nicht in die Hauptkennzahl.`,
  nothingGood: '–',
  nothingBad: '–',
  noWhy: 'Zu wenige Zahlen für eine Begründung.',
  actionPublish: 'Mindestens 1 Reel veröffentlichen (Ziel: 2 pro Woche).',
  actionHook: 'Hooks schärfen: Thema in den ersten 2 Sekunden, Frage oder überraschende Zahl.',
  actionFollowReason: 'Folgen-Grund im Video klar sagen und CTA „Folgen mit Grund“ einsetzen.',
  fallbackActions: [
    'Ein persönliches „So mache ich es“-Thema drehen.',
    'Q&A-Story machen und die Fragen als Reels einplanen.',
    'Bio und Highlights „Start hier“, „Mein Geld“, „Q&A“ prüfen.',
  ],
  progressUnknown:
    'Kein Followerstand erfasst – unter „Zahlen“ einen Kontostand eintragen, dann zeigt der Report den Fortschritt.',
  progressBase: (current: number, target: number, asOf: string) =>
    `${current} von ${target} Followern (Stand ${day(asOf)}).`,
  progressReached: 'Ziel erreicht.',
  progressOnTrack: (pace: string, needed: string) =>
    `Tempo ${pace} pro Woche, nötig sind ${needed} – das Ziel ist in Reichweite.`,
  progressBehind: (pace: string, needed: string, projected: number) =>
    `Tempo ${pace} pro Woche, nötig sind ${needed} – so wird das Ziel verfehlt (Hochrechnung: ${projected} Follower).`,
  progressBehindNoPace: (needed: string) => `Nötig sind ${needed} pro Woche.`,
  progressNoPace: (needed: string) =>
    `Nötig sind ${needed} neue Follower pro Woche; für das aktuelle Tempo fehlen noch Zahlen.`,
} as const;
