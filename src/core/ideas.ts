/**
 * Idea store logic: bulk capture (one question per line), personal-topic detection,
 * priority by growth priorities and filtering. Pure functions, no React.
 */
import type { IdeaSource, IdeaStatus } from '@/data/domain';
import type { Idea } from '@/data/schemas';
import { PERSONAL_MARKERS } from '@/data/templates';

export const MAX_BULK_IDEAS = 50;

/** Leading list markers: "-", "•", "*", "1.", "2)", "Q:"… */
const LIST_MARKER = /^\s*(?:[-•*–]+|\d+[.)]|[Qq]:|[Ff]rage:)\s*/;

/** Splits pasted text into idea titles: one per line, markers removed, no duplicates. */
export function parseBulkIdeas(text: string, maxLength = 160): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const title = line
      .replace(LIST_MARKER, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
      .trim();
    const key = title.toLocaleLowerCase('de');
    if (!title || seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
    if (titles.length >= MAX_BULK_IDEAS) break;
  }
  return titles;
}

/** True when the title reads like a personal topic ("So teile ich mein Geld auf"). */
export function looksPersonal(title: string): boolean {
  const words = title.toLocaleLowerCase('de').match(/[\p{L}]+/gu) ?? [];
  return words.some((word) => (PERSONAL_MARKERS as readonly string[]).includes(word));
}

const STATUS_ORDER: Record<IdeaStatus, number> = { idea: 0, planned: 0, filmed: 1, published: 2 };

/**
 * Priority score by the growth priorities: community questions first (priority 4: questions as
 * reels), then personal topics (priority 2), then series (priority 3), then podcast clips.
 */
export function ideaScore(idea: Pick<Idea, 'source' | 'personal' | 'series'>): number {
  let score = 0;
  if (idea.source === 'community') score += 4;
  if (idea.personal) score += 3;
  if (idea.series) score += 2;
  if (idea.source === 'podcast') score += 1;
  return score;
}

/** Open ideas first, then by score, then the newest first. */
export function sortIdeas(ideas: readonly Idea[]): Idea[] {
  return [...ideas].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      ideaScore(b) - ideaScore(a) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export interface IdeaFilter {
  status?: IdeaStatus | 'open';
  source?: IdeaSource;
  series?: string;
  query?: string;
}

export function filterIdeas(ideas: readonly Idea[], filter: IdeaFilter): Idea[] {
  const query = filter.query?.trim().toLocaleLowerCase('de');
  return ideas.filter((idea) => {
    if (filter.status === 'open' && STATUS_ORDER[idea.status] !== 0) return false;
    if (filter.status && filter.status !== 'open' && idea.status !== filter.status) return false;
    if (filter.source && idea.source !== filter.source) return false;
    if (filter.series && idea.series !== filter.series) return false;
    if (query) {
      const text = `${idea.title} ${idea.series ?? ''} ${idea.notes ?? ''}`.toLocaleLowerCase('de');
      if (!text.includes(query)) return false;
    }
    return true;
  });
}

/** All series used by ideas plus the suggestions, sorted, without duplicates. */
export function seriesOptions(ideas: readonly Idea[], suggestions: readonly string[]): string[] {
  const all = new Set<string>(suggestions);
  for (const idea of ideas) if (idea.series) all.add(idea.series);
  return [...all].sort((a, b) => a.localeCompare(b, 'de'));
}

/** Next status in the flow idea → planned → filmed → published (null at the end). */
export function nextIdeaStatus(status: IdeaStatus): IdeaStatus | null {
  const flow: IdeaStatus[] = ['idea', 'planned', 'filmed', 'published'];
  return flow[flow.indexOf(status) + 1] ?? null;
}
