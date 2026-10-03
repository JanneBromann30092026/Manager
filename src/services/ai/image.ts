/** Prepares a screenshot for Claude: scaled down (long side ≤ 1600 px) and sent as JPEG. */
import type { ImageMediaType } from './client';

export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_SIDE = 1600;

export function isSupportedImage(file: File): boolean {
  return (SCREENSHOT_TYPES as readonly string[]).includes(file.type);
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function prepareImage(
  file: Blob,
): Promise<{ mediaType: ImageMediaType; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('encode'))),
      'image/jpeg',
      0.9,
    ),
  );
  return { mediaType: 'image/jpeg', data: toBase64(await blob.arrayBuffer()) };
}
