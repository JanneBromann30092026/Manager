import { de } from '@/i18n/de';
import { InstagramError } from '@/services/instagram';

export function instagramErrorText(error: unknown): string {
  return error instanceof InstagramError
    ? de.instagram.errors[error.reason]
    : de.instagram.errors.failed;
}
