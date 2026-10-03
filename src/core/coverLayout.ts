/**
 * Cover layout (pure logic, no canvas): cover texts, line breaking, font size, pose choice and
 * the boxes for the reel cover (1080×1920) and the YouTube thumbnail (1280×720).
 */
import type { HookType } from '@/data/domain';
import { COVER_SIZES, COVER_TEXT_LIMITS, type PoseMood } from '@/data/templates';

export type CoverFormat = keyof typeof COVER_SIZES;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Measures the width of a text at a font size (canvas `measureText` in the browser). */
export type Measure = (text: string, fontSize: number) => number;

/** Uppercase, single spaces, no quotes or list markers. */
export function normalizeCoverText(text: string): string {
  return text
    .replace(/\(Claude\)/gi, ' ')
    .replace(/["„“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('de-DE');
}

export function coverWords(text: string): string[] {
  const normalized = normalizeCoverText(text);
  return normalized ? normalized.split(' ') : [];
}

/** Rule check for one text: at most 4 words (2 lines are always reached by the layout). */
export function checkCoverText(text: string): { words: number; tooLong: boolean } {
  const words = coverWords(text).length;
  return { words, tooLong: words > COVER_TEXT_LIMITS.maxWords };
}

/**
 * Reads up to three variants from the cover block ("1. …" list; continuation lines belong to
 * the item before). Without numbering every non-empty line is a variant. Placeholders "…" are
 * dropped.
 */
export function parseCoverVariants(block: string): string[] {
  const items: string[] = [];
  let numbered = false;
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(?:\d+[.)]|[-•*])\s*(.*)$/.exec(line);
    if (match) {
      numbered = true;
      items.push(match[1] ?? '');
    } else if (numbered && items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
    } else {
      items.push(line);
    }
  }
  return items
    .map((item) => normalizeCoverText(item.replace(/…/g, ' ')))
    .filter(Boolean)
    .slice(0, COVER_TEXT_LIMITS.variants);
}

/** Writes the filled variants back as numbered list (the format of the cover block). */
export function formatCoverVariants(variants: readonly string[]): string {
  return variants
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, COVER_TEXT_LIMITS.variants)
    .map((text, index) => `${index + 1}. ${text}`)
    .join('\n');
}

/**
 * Splits the words into at most two lines so that the longer line is as short as possible
 * (words are never broken). Ties keep the shorter line on top.
 */
export function splitCoverLines(words: readonly string[], measure: Measure): string[] {
  if (words.length <= 1) return words.length ? [words[0] ?? ''] : [];
  let best: string[] = [words.join(' ')];
  let bestWidth = Number.POSITIVE_INFINITY;
  for (let cut = 1; cut < words.length; cut += 1) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    const width = Math.max(...lines.map((line) => measure(line, 100)));
    if (width < bestWidth - 0.01) {
      best = lines;
      bestWidth = width;
    }
  }
  return best;
}

export const LINE_HEIGHT = 1.05;

/** Largest font size (whole pixels, between min and max) at which all lines fit into the box. */
export function fitFontSize(
  lines: readonly string[],
  box: Pick<Box, 'w' | 'h'>,
  measure: Measure,
  { min, max }: { min: number; max: number },
): number {
  if (lines.length === 0) return max;
  const fits = (size: number) =>
    lines.length * size * LINE_HEIGHT <= box.h &&
    lines.every((line) => measure(line, size) <= box.w);
  if (fits(max)) return max;
  let low = min;
  let high = max;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

export interface CoverLayout {
  format: CoverFormat;
  width: number;
  height: number;
  /** Text area (left); lines are vertically centered in it. */
  text: Box;
  fontSize: number;
  lines: string[];
  /** Line baselines (y) in drawing order. */
  baselines: number[];
  /** Photo area (right); the photo is scaled to fit and sits on the bottom edge. */
  photo: Box;
  /** Light blue accent lines (filled rectangles). */
  accents: Box[];
  /** Reel: middle 4:5 area that stays visible in the profile grid. */
  safe: Box | null;
}

interface FormatSpec {
  text: Box;
  photo: Box;
  font: { min: number; max: number };
  safe: Box | null;
}

const REEL_SAFE_HEIGHT = Math.round((COVER_SIZES.reel.width * 5) / 4);
const REEL_SAFE: Box = {
  x: 0,
  y: Math.round((COVER_SIZES.reel.height - REEL_SAFE_HEIGHT) / 2),
  w: COVER_SIZES.reel.width,
  h: REEL_SAFE_HEIGHT,
};

const SPECS: Record<CoverFormat, FormatSpec> = {
  reel: {
    safe: REEL_SAFE,
    text: { x: 72, y: REEL_SAFE.y + 150, w: 820, h: 660 },
    photo: { x: 380, y: REEL_SAFE.y + 200, w: 740, h: COVER_SIZES.reel.height - REEL_SAFE.y - 200 },
    font: { min: 56, max: 200 },
  },
  thumbnail: {
    safe: null,
    // Bigger face: the photo fills the full height and reaches into the middle.
    text: { x: 64, y: 110, w: 640, h: 500 },
    photo: { x: 560, y: 0, w: 760, h: COVER_SIZES.thumbnail.height + 40 },
    font: { min: 48, max: 170 },
  },
};

/** Complete layout of one cover for the given text. */
export function layoutCover(format: CoverFormat, text: string, measure: Measure): CoverLayout {
  const { width, height } = COVER_SIZES[format];
  const spec = SPECS[format];
  const lines = splitCoverLines(coverWords(text), measure);
  const fontSize = fitFontSize(lines, spec.text, measure, spec.font);
  const lineStep = fontSize * LINE_HEIGHT;
  const blockHeight = lines.length * lineStep;
  const top = spec.text.y + (spec.text.h - blockHeight) / 2;
  // Baseline at ~0.8 of the line (cap height of a bold sans).
  const baselines = lines.map((_, index) => Math.round(top + index * lineStep + fontSize * 0.86));
  const textWidth = Math.max(0, ...lines.map((line) => measure(line, fontSize)));
  const bar = Math.round(fontSize * 0.09);
  const gap = Math.round(fontSize * 0.32);
  const accents: Box[] = [
    { x: spec.text.x, y: Math.round(top - gap - bar), w: Math.round(fontSize * 1.2), h: bar },
    {
      x: spec.text.x,
      y: Math.round(top + blockHeight + gap),
      w: Math.round(Math.max(fontSize * 2, textWidth * 0.6)),
      h: bar,
    },
  ];
  return {
    format,
    width,
    height,
    text: spec.text,
    fontSize,
    lines,
    baselines,
    photo: spec.photo,
    accents,
    safe: spec.safe,
  };
}

/** Pose from the cover text (question → thoughtful, number → surprised), else from the hook. */
export function poseForCover(text: string, hookType?: HookType): PoseMood {
  if (text.includes('?')) return 'thoughtful';
  if (/\d/.test(text)) return 'surprised';
  if (hookType === 'question') return 'thoughtful';
  if (hookType === 'number') return 'surprised';
  return 'neutral';
}

/**
 * The image for a mood: the pose with that mood, else the neutral pose, else the cut-out photo,
 * else none (placeholder silhouette).
 */
export function pickPoseFile(
  poses: readonly { fileId: string; mood: PoseMood }[],
  mood: PoseMood,
  photoFileId?: string,
): string | undefined {
  return (
    poses.find((pose) => pose.mood === mood)?.fileId ??
    poses.find((pose) => pose.mood === 'neutral')?.fileId ??
    photoFileId
  );
}

/** Scales an image (w×h) to fit into the box, centered horizontally, standing on the bottom. */
export function fitImage(image: { w: number; h: number }, box: Box): Box {
  const scale = Math.min(box.w / image.w, box.h / image.h);
  const w = image.w * scale;
  const h = image.h * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + box.h - h, w, h };
}

/** File name for the PNG export, e.g. "cover-reel-wie-viel-sparen.png". */
export function coverFileName(format: CoverFormat, text: string): string {
  const slug = normalizeCoverText(text)
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${format === 'reel' ? 'cover-reel' : 'thumbnail'}${slug ? `-${slug}` : ''}.png`;
}
