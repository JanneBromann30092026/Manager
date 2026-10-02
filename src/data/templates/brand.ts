/** Brand kit defaults (colors taken from the cover look and the app icon). */

export const BRAND_COLOR_KEYS = ['deep', 'main', 'light', 'accent', 'text'] as const;
export type BrandColorKey = (typeof BRAND_COLOR_KEYS)[number];

export const BRAND_COLOR_DEFAULTS: Record<BrandColorKey, string> = {
  deep: '#0B2A5B',
  main: '#0369A1',
  light: '#38BDF8',
  accent: '#7DD3FC',
  text: '#FFFFFF',
};

export const BRAND_COLOR_LABELS: Record<BrandColorKey, string> = {
  deep: 'Verlauf dunkel',
  main: 'Brand-Blau',
  light: 'Verlauf hell',
  accent: 'Akzentlinien',
  text: 'Schrift',
};

/** Font files accepted for the cover font. */
export const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'] as const;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'] as const;
