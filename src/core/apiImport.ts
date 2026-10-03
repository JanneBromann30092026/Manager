/**
 * Matching of API imports (YouTube, Instagram) with existing posts: same platform id first,
 * else same platform + day + topic, else – if it is the only post of that platform on that day
 * without an id and the only imported one that day – that post (e.g. entered by hand before).
 * The rest is new.
 */
import type { Post } from '@/data/schemas';
import { normalizeKey, type MergePlan, type PostDraft } from './csvImport';

export interface ApiDraft extends PostDraft {
  externalId: string;
}

type Target = Pick<Post, 'id' | 'date' | 'platform' | 'topic'> & { externalId?: string };

export function planApiImport<T extends Target>(
  existing: readonly T[],
  drafts: readonly ApiDraft[],
): MergePlan<T>[] {
  const taken = new Set<string>();
  return drafts.map((draft) => {
    const candidates = existing.filter(
      (post) =>
        !taken.has(post.id) &&
        post.platform === draft.platform &&
        !post.externalId &&
        post.date === draft.date,
    );
    const draftsThatDay = drafts.filter(
      (other) => other.platform === draft.platform && other.date === draft.date,
    ).length;
    const target =
      existing.find(
        (post) => post.platform === draft.platform && post.externalId === draft.externalId,
      ) ??
      candidates.find(
        (post) =>
          post.topic !== undefined &&
          draft.topic !== undefined &&
          normalizeKey(post.topic) === normalizeKey(draft.topic),
      ) ??
      (candidates.length === 1 && draftsThatDay === 1 ? candidates[0] : undefined);
    if (!target) return { kind: 'create', draft };
    taken.add(target.id);
    return { kind: 'update', target, draft };
  });
}
