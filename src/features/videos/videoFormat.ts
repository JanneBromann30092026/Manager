import type { BadgeTone } from '@/components/ui';
import type { VideoStatus } from '@/data/domain';

export const VIDEO_STATUS_TONES: Record<VideoStatus, BadgeTone> = {
  idea: 'neutral',
  script: 'accent',
  filmed: 'signal',
  edited: 'warning',
  published: 'success',
};

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return dateFormat.format(new Date(year!, month! - 1, day));
}
