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
