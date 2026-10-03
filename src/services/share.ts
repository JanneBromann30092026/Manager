/** Copy and share texts (the app never publishes itself – it hands texts to other apps). */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function canShare(): boolean {
  return typeof navigator.share === 'function';
}

/** Opens the share sheet (iPad: CapCut, Instagram, Notizen …). False if cancelled. */
export async function shareText(text: string, title?: string): Promise<boolean> {
  try {
    await navigator.share({ text, title });
    return true;
  } catch {
    return false;
  }
}

export type SaveFileResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands an image to the share sheet (iPad/iPhone: „Bild sichern“ saves it in „Fotos“);
 * where files cannot be shared, it is downloaded instead.
 */
export async function saveFile(blob: Blob, name: string): Promise<SaveFileResult> {
  const file = new File([blob], name, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
