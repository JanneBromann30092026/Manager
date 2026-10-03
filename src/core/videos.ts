/**
 * Video package logic: the rules check before "fertig" and the status history.
 * Pure functions, no React.
 */
import type { VideoStatus } from '@/data/domain';
import type { Video } from '@/data/schemas';
import { INVESTMENT_KEYWORDS } from '@/data/templates';

export type CheckKey = 'hook' | 'followReason' | 'cta' | 'noAdvice' | 'sources' | 'gaps';

export interface CheckItem {
  key: CheckKey;
  ok: boolean;
}

function words(text: string): string[] {
  return text.toLocaleLowerCase('de').match(/[\p{L}]+/gu) ?? [];
}

/** Topic or script touches investing (ETF, Aktien, Depot …). */
export function isInvestmentTopic(text: string): boolean {
  return words(text).some((word) =>
    INVESTMENT_KEYWORDS.some((keyword) => word.startsWith(keyword)),
  );
}

/** A hook section whose first hook line is written (not the "…" gap of the template). */
function hasFilledHook(script: string): boolean {
  if (!/hook/i.test(script)) return false;
  const first = script.split('\n').find((line) => /^\s*1\.\s*\S/.test(line));
  return first !== undefined && !first.includes('…');
}

/** Numbers that need a source: percentages, euro amounts, years with a claim … */
const CLAIM_NUMBER = /\d[\d.,]*\s*(?:%|prozent|€|euro|mio|millionen|mrd)/i;

/**
 * Rules check (docs/INHALTE.md) before a video counts as done. Heuristic on the texts: it
 * reminds, the creator decides.
 */
export function checkVideo(
  video: Pick<Video, 'topic' | 'cta'> & { blocks: Partial<Video['blocks']> },
): CheckItem[] {
  const script = video.blocks.script ?? '';
  const lower = script.toLocaleLowerCase('de');
  const allText = [script, video.blocks.caption ?? '', video.blocks.youtube ?? ''].join('\n');
  const allLower = allText.toLocaleLowerCase('de');
  const items: CheckItem[] = [
    // A hook section with at least one filled hook line.
    { key: 'hook', ok: hasFilledHook(script) },
    { key: 'followReason', ok: /folg/.test(lower) },
    { key: 'cta', ok: video.cta !== undefined },
  ];
  if (isInvestmentTopic(`${video.topic}\n${script}`)) {
    items.push({ key: 'noAdvice', ok: allLower.includes('keine anlageberatung') });
  }
  if (CLAIM_NUMBER.test(script)) {
    items.push({ key: 'sources', ok: /quelle/i.test(script) && !/quelle:\s*…/i.test(script) });
  }
  // Fill-in gaps "…" left from the template.
  items.push({ key: 'gaps', ok: !script.includes('…') });
  return items;
}

/** Appends a status change to the history (no entry if the status did not change). */
export function withStatus(
  video: Pick<Video, 'status' | 'statusHistory'>,
  status: VideoStatus,
  at: string,
): Pick<Video, 'status' | 'statusHistory'> {
  if (video.status === status && video.statusHistory.length > 0) return video;
  return { status, statusHistory: [...video.statusHistory, { status, at }].slice(-50) };
}

/** Local calendar date "JJJJ-MM-TT". */
export function localDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
