/** CTA rotation: share → comment question → follow with a reason → share … */
import type { CtaType } from '@/data/domain';
import { CTA_ROTATION } from '@/data/templates';

export function nextCta(last: CtaType | undefined): CtaType {
  if (!last) return CTA_ROTATION[0]!;
  const index = CTA_ROTATION.indexOf(last);
  return CTA_ROTATION[(index + 1) % CTA_ROTATION.length]!;
}
