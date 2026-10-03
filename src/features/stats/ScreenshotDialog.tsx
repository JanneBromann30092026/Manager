import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ImageUp, ScanText } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { parseScreenshotAnswer, SCREENSHOT_PROMPT } from '@/core/ai/screenshot';
import { de } from '@/i18n/de';
import { AiError, generateFromImage } from '@/services/ai/client';
import { isSupportedImage, prepareImage } from '@/services/ai/image';
import { useSettings } from '@/features/settings/settingsStore';
import type { PostPrefill } from './PostEditor';

const t = de.stats.screenshot;

function Form({ onRead }: { onRead: (prefill: PostPrefill) => void }) {
  const enabled = useSettings((s) => s.aiEnabled);
  const model = useSettings((s) => s.aiModel);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = picked?.file ?? null;
  const preview = picked?.url ?? null;

  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.url);
  }, [picked]);

  if (!enabled) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-fg-secondary">{t.noAi}</p>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center font-medium text-accent-fg"
        >
          {t.toSettings}
        </Link>
      </div>
    );
  }

  const read = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await generateFromImage({
        model,
        prompt: SCREENSHOT_PROMPT,
        image: await prepareImage(file),
      });
      const result = parseScreenshotAnswer(answer);
      if (result.readFields.length === 0) setError(t.nothing);
      else onRead(result);
    } catch (caught: unknown) {
      const reason = caught instanceof AiError ? caught.reason : 'unknown';
      setError(de.settings.ai.errors[reason]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="screenshot-form">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full bg-surface-raised px-5 text-base font-medium text-fg shadow-card ring-1 ring-line">
        <ImageUp size={18} aria-hidden />
        {t.choose}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          data-testid="screenshot-file"
          onChange={(event) => {
            const next = event.target.files?.[0];
            event.target.value = '';
            if (!next) return;
            if (!isSupportedImage(next)) {
              setError(t.unsupported);
              return;
            }
            setError(null);
            setPicked({ file: next, url: URL.createObjectURL(next) });
          }}
        />
      </label>
      {preview && (
        <img
          src={preview}
          alt=""
          className="max-h-[40dvh] self-start rounded-xl border border-line object-contain"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        icon={ScanText}
        className="self-start"
        disabled={!file || busy}
        loading={busy}
        onClick={() => void read()}
        data-testid="screenshot-read"
      >
        {busy ? t.reading : t.read}
      </Button>
    </div>
  );
}

/** Screenshot → Claude reads the numbers → the post form opens with them marked „abgelesen“. */
export function ScreenshotDialog({
  open,
  onClose,
  onRead,
}: {
  open: boolean;
  onClose: () => void;
  onRead: (prefill: PostPrefill) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t.title} description={t.text}>
      {open && <Form onRead={onRead} />}
    </Modal>
  );
}
