import { useEffect, useMemo, useState } from 'react';
import type { Brand } from '@/data/schemas';
import { filesRepo } from '@/data/repositories';
import { useBrandFont } from '@/features/brand/brandFont';
import { ensureFont, fontFamilyFor, type CoverStyle } from '@/services/cover/render';

/** Decrypts the photo/pose into an ImageBitmap (null while loading, missing or unreadable). */
function useImageBitmap(fileId: string | undefined): ImageBitmap | null {
  const [image, setImage] = useState<{ id: string; bitmap: ImageBitmap } | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let active = true;
    let loaded: ImageBitmap | null = null;
    filesRepo
      .open(fileId)
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        loaded = bitmap;
        if (active) setImage({ id: fileId, bitmap });
        else bitmap.close();
      })
      .catch(() => {
        // Unreadable image (e.g. HEIC outside Safari): placeholder silhouette.
      });
    return () => {
      active = false;
      loaded?.close();
    };
  }, [fileId]);
  return fileId && image?.id === fileId ? image.bitmap : null;
}

/** Everything the renderer needs from the brand kit; `ready` once the font can be drawn. */
export function useCoverStyle(
  brand: Brand,
  imageFileId: string | undefined,
): { style: CoverStyle; ready: boolean } {
  const brandFont = useBrandFont(brand.fontFileId);
  const family = fontFamilyFor(brandFont);
  const image = useImageBitmap(imageFileId);
  const [readyFamily, setReadyFamily] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void ensureFont(family).then(() => {
      if (active) setReadyFamily(family);
    });
    return () => {
      active = false;
    };
  }, [family]);

  const style = useMemo<CoverStyle>(
    () => ({ colors: brand.colors, fontFamily: family, image }),
    [brand.colors, family, image],
  );
  return { style, ready: readyFamily === family };
}
