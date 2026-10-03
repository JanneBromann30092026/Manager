import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui';
import type { CoverFormat } from '@/core/coverLayout';
import { COVER_SIZES } from '@/data/templates';
import { drawCover, type CoverStyle } from '@/services/cover/render';

export interface CoverCanvasProps {
  format: CoverFormat;
  text: string;
  style: CoverStyle;
  ready: boolean;
  guide?: boolean;
  label: string;
  className?: string;
  testId?: string;
}

/** Full-resolution cover drawn into a canvas that scales with its container. */
export function CoverCanvas({
  format,
  text,
  style,
  ready,
  guide = false,
  label,
  className,
  testId,
}: CoverCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = COVER_SIZES[format];

  useEffect(() => {
    if (!ready || !ref.current) return;
    drawCover(ref.current, format, text, { ...style, guide });
  }, [format, text, style, ready, guide]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      data-testid={testId}
      data-ready={ready ? 'true' : 'false'}
      className={cn('block h-auto w-full rounded-lg bg-brand-deep shadow-card', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
