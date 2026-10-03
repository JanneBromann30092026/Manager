import { describe, expect, it } from 'vitest';
import {
  checkCoverText,
  coverFileName,
  fitFontSize,
  fitImage,
  formatCoverVariants,
  layoutCover,
  type Measure,
  normalizeCoverText,
  parseCoverVariants,
  pickPoseFile,
  poseForCover,
  splitCoverLines,
} from './coverLayout';

/** Monospace stand-in for canvas measureText: every character is 0.6 × font size wide. */
const measure: Measure = (text, size) => text.length * size * 0.6;

describe('cover texts', () => {
  it('normalizes to uppercase without quotes and extra spaces', () => {
    expect(normalizeCoverText('  „wie viel   sparen?“ (Claude) ')).toBe('WIE VIEL SPAREN?');
  });

  it('reads numbered variants, joins continuation lines, drops placeholders', () => {
    const block = '1. WIE VIEL\n   SPAREN?\n2) 50 € IM MONAT\n3. …\n4. ZU VIEL';
    expect(parseCoverVariants(block)).toEqual(['WIE VIEL SPAREN?', '50 € IM MONAT', 'ZU VIEL']);
  });

  it('takes plain lines as variants', () => {
    expect(parseCoverVariants('Mein Gehalt\nDrei Konten')).toEqual(['MEIN GEHALT', 'DREI KONTEN']);
  });

  it('formats the variants as numbered list again', () => {
    expect(formatCoverVariants(['A B', ' C ', 'D', 'E'])).toBe('1. A B\n2. C\n3. D');
    expect(formatCoverVariants(['', 'B', ' '])).toBe('1. B');
  });

  it('flags more than 4 words', () => {
    expect(checkCoverText('eins zwei drei vier')).toEqual({ words: 4, tooLong: false });
    expect(checkCoverText('eins zwei drei vier fünf').tooLong).toBe(true);
  });
});

describe('line breaking and font size', () => {
  it('balances two lines and never breaks words', () => {
    expect(splitCoverLines(['WIE', 'VIEL', 'GEHALT', 'SPAREN?'], measure)).toEqual([
      'WIE VIEL',
      'GEHALT SPAREN?',
    ]);
    expect(splitCoverLines(['ETF'], measure)).toEqual(['ETF']);
    expect(splitCoverLines([], measure)).toEqual([]);
  });

  it('keeps the shorter line on top on ties', () => {
    expect(splitCoverLines(['AB', 'CD'], measure)).toEqual(['AB', 'CD']);
  });

  it('finds the largest size that fits width and height', () => {
    const size = fitFontSize(['GEHALT SPAREN?'], { w: 600, h: 640 }, measure, {
      min: 40,
      max: 190,
    });
    expect(measure('GEHALT SPAREN?', size)).toBeLessThanOrEqual(600);
    expect(measure('GEHALT SPAREN?', size + 1)).toBeGreaterThan(600);
    expect(fitFontSize(['A'], { w: 600, h: 640 }, measure, { min: 40, max: 190 })).toBe(190);
    expect(fitFontSize(['A'.repeat(100)], { w: 60, h: 60 }, measure, { min: 40, max: 190 })).toBe(
      40,
    );
  });
});

describe('layoutCover', () => {
  it('keeps the reel text inside the middle 4:5 area', () => {
    const layout = layoutCover('reel', 'Wie viel Gehalt sparen?', measure);
    expect(layout.width).toBe(1080);
    expect(layout.height).toBe(1920);
    expect(layout.safe).toEqual({ x: 0, y: 285, w: 1080, h: 1350 });
    expect(layout.lines).toHaveLength(2);
    const safe = layout.safe!;
    for (const box of [layout.text, ...layout.accents]) {
      expect(box.y).toBeGreaterThanOrEqual(safe.y);
      expect(box.y + box.h).toBeLessThanOrEqual(safe.y + safe.h);
    }
    for (const line of layout.lines) {
      expect(measure(line, layout.fontSize)).toBeLessThanOrEqual(layout.text.w);
    }
    expect(
      Math.abs(layout.baselines[1]! - layout.baselines[0]! - layout.fontSize * 1.05),
    ).toBeLessThanOrEqual(1);
  });

  it('gives the thumbnail a bigger photo area than its text area', () => {
    const layout = layoutCover('thumbnail', '50 € im Monat', measure);
    expect(layout.width).toBe(1280);
    expect(layout.height).toBe(720);
    expect(layout.safe).toBeNull();
    expect(layout.photo.h).toBeGreaterThanOrEqual(720);
    expect(layout.text.x + layout.text.w).toBeLessThanOrEqual(1280);
  });

  it('works without text', () => {
    const layout = layoutCover('reel', '', measure);
    expect(layout.lines).toEqual([]);
    expect(layout.baselines).toEqual([]);
  });
});

describe('poses', () => {
  it('chooses the mood from the text, then from the hook type', () => {
    expect(poseForCover('WIE VIEL SPAREN?')).toBe('thoughtful');
    expect(poseForCover('50 € IM MONAT')).toBe('surprised');
    expect(poseForCover('MEIN GEHALT', 'number')).toBe('surprised');
    expect(poseForCover('MEIN GEHALT', 'question')).toBe('thoughtful');
    expect(poseForCover('MEIN GEHALT', 'contradiction')).toBe('neutral');
  });

  it('falls back to the neutral pose, then to the photo', () => {
    const poses = [
      { fileId: 'n', mood: 'neutral' as const },
      { fileId: 't', mood: 'thoughtful' as const },
    ];
    expect(pickPoseFile(poses, 'thoughtful', 'p')).toBe('t');
    expect(pickPoseFile(poses, 'surprised', 'p')).toBe('n');
    expect(pickPoseFile([], 'surprised', 'p')).toBe('p');
    expect(pickPoseFile([], 'surprised')).toBeUndefined();
  });

  it('fits an image on the bottom edge of the box', () => {
    expect(fitImage({ w: 500, h: 1000 }, { x: 0, y: 0, w: 1000, h: 1000 })).toEqual({
      x: 250,
      y: 0,
      w: 500,
      h: 1000,
    });
    expect(fitImage({ w: 1000, h: 500 }, { x: 0, y: 0, w: 1000, h: 1000 })).toEqual({
      x: 0,
      y: 500,
      w: 1000,
      h: 500,
    });
  });
});

it('builds readable file names', () => {
  expect(coverFileName('reel', 'Wie viel Gehalt für Ärger?')).toBe(
    'cover-reel-wie-viel-gehalt-fuer-aerger.png',
  );
  expect(coverFileName('thumbnail', '')).toBe('thumbnail.png');
});
