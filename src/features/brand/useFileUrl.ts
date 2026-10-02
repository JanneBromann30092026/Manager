import { useEffect, useState } from 'react';
import { filesRepo } from '@/data/repositories';

/** Decrypts a stored file into a temporary object URL (revoked when no longer needed). */
export function useFileUrl(fileId: string | undefined): string | null {
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!fileId) return;
    let objectUrl: string | null = null;
    let active = true;
    filesRepo
      .open(fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl({ id: fileId, url: objectUrl });
      })
      .catch(() => {
        // Missing or unreadable file: show nothing.
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  return fileId && url?.id === fileId ? url.url : null;
}
