/**
 * The uploaded cover font, registered via FontFace from the decrypted bytes (no URL, so the
 * CSP needs no font source). Used by the brand preview and the cover studio (step 6).
 */
import { useEffect, useState } from 'react';
import { filesRepo } from '@/data/repositories';

export const BRAND_FONT_FAMILY = 'Manager Brand';

let current: { fileId: string; face: FontFace } | null = null;

/** Checks that the bytes are a font the browser can use. */
export async function parseFont(data: ArrayBuffer): Promise<FontFace> {
  const face = new FontFace(BRAND_FONT_FAMILY, data);
  await face.load();
  return face;
}

/** Registers the font of the given file (replacing an earlier one); null removes it. */
export async function applyBrandFont(fileId: string | undefined): Promise<boolean> {
  if (current?.fileId === fileId) return true;
  if (current) {
    document.fonts.delete(current.face);
    current = null;
  }
  if (!fileId) return false;
  const blob = await filesRepo.open(fileId);
  const face = await parseFont(await blob.arrayBuffer());
  document.fonts.add(face);
  current = { fileId, face };
  return true;
}

/** True while the brand font of the given file is registered. */
export function useBrandFont(fileId: string | undefined): boolean {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    applyBrandFont(fileId)
      .then((ok) => {
        if (active) setLoaded(ok && fileId ? fileId : null);
      })
      .catch(() => {
        if (active) setLoaded(null);
      });
    return () => {
      active = false;
    };
  }, [fileId]);
  return fileId !== undefined && loaded === fileId;
}
