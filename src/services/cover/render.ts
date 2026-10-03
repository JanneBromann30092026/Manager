/**
 * Draws a cover with Canvas 2D: blue gradient (dark bottom left → light top right), light blue
 * accent lines, photo or placeholder silhouette on the right, white bold text on the left.
 * The layout comes from src/core/coverLayout.ts.
 */
import { fitImage, layoutCover, type CoverFormat, type CoverLayout } from '@/core/coverLayout';
import type { Brand } from '@/data/schemas';

export interface CoverStyle {
  colors: Brand['colors'];
  /** CSS font family (brand font or Inter). */
  fontFamily: string;
  /** Cut-out photo or pose; null draws the placeholder silhouette. */
  image: (CanvasImageSource & { width: number; height: number }) | null;
  /** Preview only: outline of the 4:5 area that stays visible in the profile grid. */
  guide?: boolean;
}

const FALLBACK_FONT = '"Inter Variable", system-ui, sans-serif';

function fontString(family: string, size: number): string {
  return `800 ${size}px ${family === FALLBACK_FONT ? FALLBACK_FONT : `"${family}", ${FALLBACK_FONT}`}`;
}

export function fontFamilyFor(brandFontLoaded: boolean): string {
  return brandFontLoaded ? 'Manager Brand' : FALLBACK_FONT;
}

/** Waits until the font can be used on a canvas (Safari draws a fallback otherwise). */
export async function ensureFont(family: string): Promise<void> {
  try {
    await document.fonts.load(fontString(family, 100), 'ÄBC?€1');
  } catch {
    // Fallback font is fine.
  }
}

function measureWith(ctx: CanvasRenderingContext2D, family: string) {
  return (text: string, size: number) => {
    ctx.font = fontString(family, size);
    return ctx.measureText(text).width;
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function drawBackground(ctx: CanvasRenderingContext2D, layout: CoverLayout, style: CoverStyle) {
  const { width: w, height: h } = layout;
  const gradient = ctx.createLinearGradient(0, h, w, 0);
  gradient.addColorStop(0, style.colors.deep);
  gradient.addColorStop(0.55, style.colors.main);
  gradient.addColorStop(1, style.colors.light);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Two diagonal light blue lines in the background (like the app icon).
  ctx.save();
  ctx.strokeStyle = hexToRgba(style.colors.accent, 0.35);
  ctx.lineCap = 'round';
  const unit = Math.min(w, h);
  ctx.lineWidth = unit * 0.012;
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h);
  ctx.lineTo(w, h - w * 0.75);
  ctx.moveTo(w * 0.62, h);
  ctx.lineTo(w, h - w * 0.5);
  ctx.stroke();
  ctx.restore();

  // Thumbnail: darker left side for more contrast behind the text.
  if (layout.format === 'thumbnail') {
    const shade = ctx.createLinearGradient(0, 0, w * 0.6, 0);
    shade.addColorStop(0, hexToRgba(style.colors.deep, 0.75));
    shade.addColorStop(1, hexToRgba(style.colors.deep, 0));
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Neutral head-and-shoulders shape where the photo will go (no real photos in demos). */
function drawSilhouette(ctx: CanvasRenderingContext2D, layout: CoverLayout) {
  const box = layout.photo;
  const cx = box.x + box.w * 0.55;
  const bottom = Math.min(box.y + box.h, layout.height);
  const head = box.w * 0.26;
  const headY = bottom - head * 3.1;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(3, head * 0.03);
  ctx.beginPath();
  ctx.arc(cx, headY, head, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const shoulders = head * 2.2;
  ctx.moveTo(cx - shoulders, bottom);
  ctx.bezierCurveTo(
    cx - shoulders,
    headY + head * 1.4,
    cx + shoulders,
    headY + head * 1.4,
    cx + shoulders,
    bottom,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, layout: CoverLayout, style: CoverStyle) {
  ctx.save();
  ctx.font = fontString(style.fontFamily, layout.fontSize);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  layout.lines.forEach((line, index) => {
    const y = layout.baselines[index] ?? 0;
    if (layout.format === 'thumbnail') {
      ctx.strokeStyle = hexToRgba(style.colors.deep, 0.9);
      ctx.lineWidth = layout.fontSize * 0.1;
      ctx.strokeText(line, layout.text.x, y);
    }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = layout.fontSize * 0.12;
    ctx.shadowOffsetY = layout.fontSize * 0.03;
    ctx.fillStyle = style.colors.text;
    ctx.fillText(line, layout.text.x, y);
    ctx.shadowColor = 'transparent';
  });
  ctx.restore();

  ctx.fillStyle = style.colors.accent;
  for (const bar of layout.accents) {
    ctx.beginPath();
    ctx.roundRect(bar.x, bar.y, bar.w, bar.h, bar.h / 2);
    ctx.fill();
  }
}

function drawGuide(ctx: CanvasRenderingContext2D, layout: CoverLayout) {
  if (!layout.safe) return;
  const { safe, width, height } = layout;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, width, safe.y);
  ctx.fillRect(0, safe.y + safe.h, width, height - safe.y - safe.h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 6;
  ctx.setLineDash([24, 18]);
  ctx.strokeRect(safe.x + 3, safe.y, safe.w - 6, safe.h);
  ctx.restore();
}

/** Draws the cover into the canvas (sets its size to the export size). */
export function drawCover(
  canvas: HTMLCanvasElement,
  format: CoverFormat,
  text: string,
  style: CoverStyle,
): CoverLayout | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const layout = layoutCover(format, text, measureWith(ctx, style.fontFamily));
  canvas.width = layout.width;
  canvas.height = layout.height;
  ctx.clearRect(0, 0, layout.width, layout.height);
  drawBackground(ctx, layout, style);
  if (style.image) {
    const box = fitImage({ w: style.image.width, h: style.image.height }, layout.photo);
    ctx.drawImage(style.image, box.x, box.y, box.w, box.h);
  } else {
    drawSilhouette(ctx, layout);
  }
  drawText(ctx, layout, style);
  if (style.guide) drawGuide(ctx, layout);
  return layout;
}

/** Renders the cover (without guide) as PNG. */
export async function renderCoverPng(
  format: CoverFormat,
  text: string,
  style: CoverStyle,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawCover(canvas, format, text, { ...style, guide: false });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
      'image/png',
    );
  });
}
