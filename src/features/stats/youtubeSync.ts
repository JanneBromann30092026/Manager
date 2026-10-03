import { useEffect } from 'react';
import { create } from 'zustand';
import { toast } from '@/components/ui';
import { planApiImport } from '@/core/apiImport';
import { localDateOf } from '@/core/dates';
import { isSyncDue } from '@/core/instagram';
import { postsRepo } from '@/data/repositories';
import { useDataStore } from '@/data/store';
import { de } from '@/i18n/de';
import { signOut, useGoogleAuth, validToken } from '@/services/google/auth';
import { useVault } from '@/services/vault';
import { fetchYouTube, YouTubeError } from '@/services/youtube';
import { useSettings } from '@/features/settings/settingsStore';
import { applyImport, saveFollowerCount } from './statsActions';

interface SyncState {
  running: boolean;
  /** Error of the last fetch (cleared by the next successful one). */
  error: unknown;
}

/** YouTube fetch status of this session (not stored). */
export const useYouTubeSync = create<SyncState>(() => ({ running: false, error: null }));

useVault.subscribe((state) => {
  if (state.status !== 'unlocked' && useYouTubeSync.getState().error !== null)
    useYouTubeSync.setState({ error: null });
});

/**
 * Reads channel, videos and analytics with the Google sign-in of this session, merges them into
 * „Zahlen“ (new posts, fresh values, Verlauf) and stores today's subscriber count.
 */
export async function syncYouTube(): Promise<{ created: number; updated: number } | null> {
  if (useYouTubeSync.getState().running) return null;
  const token = validToken();
  if (!token) {
    signOut();
    const error = new YouTubeError('auth');
    useYouTubeSync.setState({ error });
    throw error;
  }
  useYouTubeSync.setState({ running: true });
  try {
    const result = await fetchYouTube(token.accessToken);
    const done = await applyImport(planApiImport(postsRepo.list(), result.drafts), 'youtubeApi');
    if (result.channel.subscribers !== undefined)
      await saveFollowerCount('youtube', result.channel.subscribers, 'youtubeApi', localDateOf());
    await useSettings.getState().set('youtubeSyncedAt', new Date().toISOString());
    useYouTubeSync.setState({ running: false, error: null });
    return done;
  } catch (error: unknown) {
    if (error instanceof YouTubeError && error.reason === 'auth') signOut();
    useYouTubeSync.setState({ running: false, error });
    throw error;
  }
}

/**
 * Google sign-ins last one hour (no refresh without a server). While one is valid, YouTube is
 * fetched automatically: right after signing in and when the app comes back to the foreground,
 * if the last fetch is 6 hours old.
 */
export function useYouTubeAutoSync(): void {
  const ready = useDataStore((s) => s.ready);
  const enabled = useSettings((s) => s.loaded && s.youtubeAutoSync);
  const token = useGoogleAuth((s) => s.token);
  useEffect(() => {
    if (!ready || !enabled || !token) return;
    // A new sign-in gets a fresh try.
    useYouTubeSync.setState({ error: null });
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (useYouTubeSync.getState().running || useYouTubeSync.getState().error !== null) return;
      if (!isSyncDue(useSettings.getState().youtubeSyncedAt, new Date())) return;
      void syncYouTube()
        .then((done) => {
          if (done && done.created > 0) toast.info(de.youtube.sync.newVideos(done.created));
        })
        // Errors stay quiet here; the YouTube status in „Zahlen“ shows them.
        .catch(() => undefined);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [ready, enabled, token]);
}
