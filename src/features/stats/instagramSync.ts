import { useEffect } from 'react';
import { create } from 'zustand';
import { toast } from '@/components/ui';
import { planApiImport } from '@/core/apiImport';
import { localDateOf } from '@/core/dates';
import { isSyncDue } from '@/core/instagram';
import { postsRepo } from '@/data/repositories';
import { useDataStore } from '@/data/store';
import { de } from '@/i18n/de';
import { fetchInstagram, loadToken } from '@/services/instagram';
import { useVault } from '@/services/vault';
import { useSettings } from '@/features/settings/settingsStore';
import { applyImport, saveFollowerCount } from './statsActions';

/** After a failed automatic fetch, wait this long before trying again. */
const RETRY_MINUTES = 30;
/** How often the open app checks whether a fetch is due. */
const CHECK_MINUTES = 15;

interface SyncState {
  running: boolean;
  /** Error of the last fetch (cleared by the next successful one). */
  error: unknown;
  lastAttemptAt: number;
}

/** Instagram fetch status of this session (not stored). */
export const useInstagramSync = create<SyncState>(() => ({
  running: false,
  error: null,
  lastAttemptAt: 0,
}));

useVault.subscribe((state) => {
  if (state.status !== 'unlocked' && useInstagramSync.getState().error !== null)
    useInstagramSync.setState({ error: null });
});

/**
 * Reads all reels with their numbers, merges them into „Zahlen“ (new posts, fresh values,
 * Verlauf) and stores today's follower count.
 */
export async function syncInstagram(): Promise<{ created: number; updated: number } | null> {
  if (useInstagramSync.getState().running) return null;
  useInstagramSync.setState({ running: true, lastAttemptAt: Date.now() });
  try {
    const result = await fetchInstagram();
    const done = await applyImport(planApiImport(postsRepo.list(), result.drafts), 'instagramApi');
    if (result.profile.followers_count !== undefined)
      await saveFollowerCount(
        'instagram',
        result.profile.followers_count,
        'instagramApi',
        localDateOf(),
      );
    await useSettings.getState().set('instagramSyncedAt', new Date().toISOString());
    useInstagramSync.setState({ running: false, error: null });
    return done;
  } catch (error: unknown) {
    useInstagramSync.setState({ running: false, error });
    throw error;
  }
}

async function autoSync(): Promise<void> {
  const { running, lastAttemptAt } = useInstagramSync.getState();
  if (running || Date.now() - lastAttemptAt < RETRY_MINUTES * 60 * 1000) return;
  if (!isSyncDue(useSettings.getState().instagramSyncedAt, new Date())) return;
  const record = await loadToken();
  if (!record || Date.parse(record.expiresAt) <= Date.now()) return;
  const done = await syncInstagram();
  if (done && done.created > 0) toast.info(de.instagram.sync.newReels(done.created));
}

/**
 * Fetches Instagram automatically while the app is unlocked: on opening, when it comes back to
 * the foreground and every 15 minutes it checks whether the last fetch is 6 hours old.
 */
export function useInstagramAutoSync(): void {
  const ready = useDataStore((s) => s.ready);
  const enabled = useSettings((s) => s.loaded && s.instagramAutoSync);
  useEffect(() => {
    if (!ready || !enabled) return;
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      // Errors stay quiet here; the Instagram status in „Zahlen“ shows them.
      void autoSync().catch(() => undefined);
    };
    check();
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, CHECK_MINUTES * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [ready, enabled]);
}
