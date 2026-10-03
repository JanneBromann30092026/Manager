/**
 * Instagram read only (graph.instagram.com). The long-lived token is an encrypted secret; it is
 * decrypted only for a request, never logged, never exported. Requests are simple GETs with the
 * token as query parameter (documented by Meta; no CORS preflight needed).
 */
import type { z } from 'zod';
import type { ApiDraft } from '@/core/apiImport';
import {
  errorSchema,
  IG_API,
  IG_REFRESH_URL,
  insightsSchema,
  insightValues,
  isReel,
  mediaPageSchema,
  newTokenRecord,
  profileSchema,
  reelToDraft,
  refreshSchema,
  REEL_METRICS,
  shouldAutoRefresh,
  tokenRecordSchema,
  type InstagramMedia,
  type InstagramProfile,
  type TokenRecord,
} from '@/core/instagram';
import { create } from 'zustand';
import { secretsRepo } from '@/data/repositories';
import { useVault } from '@/services/vault';

/** The newest posts are enough for the evaluation. */
const MAX_MEDIA = 100;

export type InstagramErrorReason = 'noToken' | 'token' | 'permission' | 'network' | 'failed';

export class InstagramError extends Error {
  constructor(readonly reason: InstagramErrorReason) {
    super(`Instagram request failed: ${reason}`);
    this.name = 'InstagramError';
  }
}

async function getJson<S extends z.ZodType>(url: string, schema: S): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(url, { referrerPolicy: 'no-referrer' });
  } catch {
    throw new InstagramError('network');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = errorSchema.safeParse(body);
    const code = error.success ? error.data.error.code : undefined;
    if (code === 190 || response.status === 401) throw new InstagramError('token');
    if (code === 10 || code === 200 || response.status === 403)
      throw new InstagramError('permission');
    throw new InstagramError('failed');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new InstagramError('failed');
  return parsed.data;
}

function withToken(url: string, token: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ ...params, access_token: token });
  return `${url}?${query.toString()}`;
}

// --- Token (encrypted secret) -------------------------------------------------------

export async function loadToken(): Promise<TokenRecord | null> {
  const raw = await secretsRepo.get('instagramToken');
  if (!raw) return null;
  try {
    return tokenRecordSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function storeToken(record: TokenRecord): Promise<void> {
  await secretsRepo.set('instagramToken', JSON.stringify(record));
}

export async function removeToken(): Promise<void> {
  await secretsRepo.remove('instagramToken');
  useInstagramToken.getState().reload();
}

/** What the UI may show about the token (never the token itself). */
export interface TokenInfo {
  savedAt: string;
  expiresAt: string;
  username?: string;
}

interface TokenState {
  info: TokenInfo | null;
  loaded: boolean;
  reload: () => void;
}

/** Token status for settings, import and the reminder; dropped when the app locks. */
export const useInstagramToken = create<TokenState>((set) => ({
  info: null,
  loaded: false,
  reload: () => {
    void loadToken()
      .then((record) =>
        set({
          info: record
            ? { savedAt: record.savedAt, expiresAt: record.expiresAt, username: record.username }
            : null,
          loaded: true,
        }),
      )
      .catch(() => set({ info: null, loaded: true }));
  },
}));

useVault.subscribe((state) => {
  if (state.status !== 'unlocked' && useInstagramToken.getState().loaded)
    useInstagramToken.setState({ info: null, loaded: false });
});

export async function fetchProfile(token: string): Promise<InstagramProfile> {
  return getJson(
    withToken(`${IG_API}/me`, token, {
      fields: 'user_id,username,account_type,followers_count,media_count',
    }),
    profileSchema,
  );
}

/** Checks a pasted token with the profile and stores it (60 days from now). */
export async function saveToken(accessToken: string): Promise<InstagramProfile> {
  const profile = await fetchProfile(accessToken);
  await storeToken({ ...newTokenRecord(accessToken, new Date()), username: profile.username });
  useInstagramToken.getState().reload();
  return profile;
}

/** Extends the token by 60 days (Meta: only tokens older than 24 h). */
export async function refreshToken(record: TokenRecord): Promise<TokenRecord> {
  const data = await getJson(
    withToken(IG_REFRESH_URL, record.accessToken, { grant_type: 'ig_refresh_token' }),
    refreshSchema,
  );
  const next = {
    ...newTokenRecord(data.access_token, new Date(), data.expires_in),
    username: record.username,
  };
  await storeToken(next);
  useInstagramToken.getState().reload();
  return next;
}

/** Valid token for a request; refreshes it on the way when Meta allows it. */
async function activeToken(): Promise<string> {
  const record = await loadToken();
  if (!record) throw new InstagramError('noToken');
  if (Date.parse(record.expiresAt) <= Date.now()) throw new InstagramError('token');
  if (shouldAutoRefresh(record, new Date())) {
    try {
      return (await refreshToken(record)).accessToken;
    } catch (error: unknown) {
      if (error instanceof InstagramError && error.reason === 'token') throw error;
      // A failed refresh does not block reading with the still valid token.
    }
  }
  return record.accessToken;
}

// --- Media and insights -----------------------------------------------------------------

async function fetchMedia(token: string): Promise<InstagramMedia[]> {
  const media: InstagramMedia[] = [];
  let url: string | undefined = withToken(`${IG_API}/me/media`, token, {
    fields: 'id,caption,media_type,media_product_type,timestamp',
    limit: '50',
  });
  while (url && media.length < MAX_MEDIA) {
    const page: z.output<typeof mediaPageSchema> = await getJson(url, mediaPageSchema);
    media.push(...page.data);
    const next = page.paging?.next;
    url = next?.startsWith('https://graph.instagram.com/') ? next : undefined;
  }
  return media.slice(0, MAX_MEDIA);
}

export interface InstagramFetchResult {
  profile: InstagramProfile;
  drafts: ApiDraft[];
  /** Posts that are not reels (photos, carousels, stories) and were skipped. */
  skipped: number;
  /** Reels whose insights could not be read (values stay empty). */
  insightsFailed: number;
}

/** Reads profile, reels and their insights. */
export async function fetchInstagram(): Promise<InstagramFetchResult> {
  const token = await activeToken();
  const profile = await fetchProfile(token);
  const media = await fetchMedia(token);
  const reels = media.filter(isReel);
  const drafts: ApiDraft[] = [];
  let insightsFailed = 0;
  for (const reel of reels) {
    try {
      const insights = await getJson(
        withToken(`${IG_API}/${encodeURIComponent(reel.id)}/insights`, token, {
          metric: REEL_METRICS.join(','),
        }),
        insightsSchema,
      );
      drafts.push(reelToDraft(reel, insightValues(insights)));
    } catch (error: unknown) {
      if (error instanceof InstagramError && error.reason === 'token') throw error;
      insightsFailed += 1;
      drafts.push(reelToDraft(reel));
    }
  }
  return { profile, drafts, skipped: media.length - reels.length, insightsFailed };
}
