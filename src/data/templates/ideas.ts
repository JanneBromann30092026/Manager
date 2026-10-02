/** Labels and suggestions of the idea store ("Ideen-Speicher", docs/INHALTE.md). */
import type { IdeaSource, IdeaStatus } from '../domain';

export const IDEA_SOURCE_LABELS: Record<IdeaSource, string> = {
  own: 'Eigene Idee',
  community: 'Community-Frage',
  podcast: 'Podcast',
};

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  idea: 'Idee',
  planned: 'Geplant',
  filmed: 'Gedreht',
  published: 'Veröffentlicht',
};

/** Series from the growth priorities; the creator can type new ones. */
export const SERIES_SUGGESTIONS = [
  'Finanzbruder erklärt',
  'Mythen-Check',
  'Geldfehler mit 20',
] as const;

/**
 * Words that mark a personal "so mache ich es" topic (growth priority 2). Used to preselect
 * the "persönlich" switch for own ideas (community questions are asked from the viewer's
 * side, so their "ich" says nothing); the creator can always change it.
 */
export const PERSONAL_MARKERS = ['ich', 'mein', 'meine', 'meinen', 'meinem', 'meiner'] as const;
