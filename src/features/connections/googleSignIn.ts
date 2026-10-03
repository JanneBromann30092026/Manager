import { toast } from '@/components/ui';
import type { AuthMode } from '@/core/google/oauth';
import { de } from '@/i18n/de';
import { GoogleAuthError, signIn, takeRedirectResult } from '@/services/google/auth';
import { YouTubeError } from '@/services/youtube';
import { useSettings } from '@/features/settings/settingsStore';

const t = de.youtube;

export function authErrorText(error: unknown): string {
  if (error instanceof GoogleAuthError) return t.authErrors[error.reason];
  if (error instanceof YouTubeError) return t.errors[error.reason];
  return t.errors.failed;
}

/** Signs in with the stored client id; returns true when a token is there. */
export async function startSignIn(mode: AuthMode): Promise<boolean> {
  try {
    await signIn(useSettings.getState().googleClientId, mode);
    toast.success(t.signedInToast);
    return true;
  } catch (error: unknown) {
    if (!(error instanceof GoogleAuthError && error.reason === 'cancelled'))
      toast.error(authErrorText(error));
    return false;
  }
}

/** Picks up a redirect sign-in after unlocking (once). */
export function finishRedirectSignIn(): void {
  try {
    if (takeRedirectResult()) toast.success(t.signedInToast);
  } catch (error: unknown) {
    toast.error(authErrorText(error));
  }
}

export function formatCount(value: number | undefined): string {
  return value === undefined ? '–' : value.toLocaleString('de-DE');
}
