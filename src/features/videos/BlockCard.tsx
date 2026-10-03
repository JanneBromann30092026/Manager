import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ClipboardCopy, FileText, Image, Share2, Sparkles } from 'lucide-react';
import { Badge, Button, ConfirmDialog, Surface, Textarea, toast } from '@/components/ui';
import type { VideoBlockKey } from '@/data/domain';
import type { Video } from '@/data/schemas';
import { VIDEO_BLOCK_TEMPLATES } from '@/data/templates';
import { de } from '@/i18n/de';
import { AiError } from '@/services/ai/client';
import { canShare, copyText, shareText } from '@/services/share';
import { generateBlock, setBlock } from './videoActions';

const t = de.videos.block;

/** One building block: editable text, template, copy/share, optional Claude draft. */
export function BlockCard({
  video,
  blockKey,
  ai,
  busy,
  onBusy,
}: {
  video: Video;
  blockKey: VideoBlockKey;
  /** Model ID when the AI is on, otherwise null. */
  ai: string | null;
  busy: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const template = VIDEO_BLOCK_TEMPLATES[blockKey];
  const stored = video.blocks[blockKey] ?? '';
  const [draft, setDraft] = useState(stored);
  const [synced, setSynced] = useState(stored);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  if (synced !== stored) {
    setSynced(stored);
    setDraft(stored);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const fromAi = video.aiBlocks.includes(blockKey);
  const context = { topic: video.topic, kind: video.kind, cta: video.cta ?? 'share' };

  const save = (text: string) => {
    window.clearTimeout(timer.current);
    if (text === stored) return;
    void setBlock(video, blockKey, text);
  };

  const run = async () => {
    if (!ai) return;
    onBusy(true);
    try {
      await generateBlock(video, blockKey, ai);
    } catch (error: unknown) {
      const reason = error instanceof AiError ? error.reason : 'unknown';
      toast.error(de.settings.ai.errors[reason]);
    } finally {
      onBusy(false);
    }
  };

  return (
    <Surface>
      <section className="flex flex-col gap-3" data-testid={`block-${blockKey}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-fg">{template.label}</h2>
          {fromAi && (
            <Badge tone="accent">
              <span title={t.claudeHint}>{t.claude}</span>
            </Badge>
          )}
          <span className="w-full text-sm text-fg-muted">{template.hint}</span>
        </div>
        <Textarea
          label={template.label}
          className="font-mono text-[0.95rem]"
          rows={draft ? 6 : 3}
          maxHeight={560}
          placeholder={t.empty}
          value={draft}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => save(text), 800);
          }}
          onBlur={() => save(draft)}
          data-testid={`block-${blockKey}-text`}
        />
        <details className="text-sm text-fg-secondary">
          <summary className="min-h-11 cursor-pointer content-center">{t.rules}</summary>
          <ul className="flex list-disc flex-col gap-1 pb-2 pl-5">
            {template.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>
        <div className="flex flex-wrap gap-2">
          {!draft.trim() && (
            <Button
              variant="secondary"
              size="sm"
              icon={FileText}
              onClick={() => {
                const text = template.template(context);
                setDraft(text);
                save(text);
              }}
            >
              {t.insertTemplate}
            </Button>
          )}
          {ai && (
            <Button
              variant="secondary"
              size="sm"
              icon={Sparkles}
              disabled={busy}
              onClick={() => (draft.trim() ? setConfirmGenerate(true) : void run())}
            >
              {draft.trim() ? t.regenerate : t.generate}
            </Button>
          )}
          {draft.trim() && (
            <Button
              variant="ghost"
              size="sm"
              icon={ClipboardCopy}
              onClick={() =>
                void copyText(draft).then((ok) => {
                  if (ok) toast.success(t.copied);
                })
              }
            >
              {t.copy}
            </Button>
          )}
          {draft.trim() && canShare() && (
            <Button
              variant="ghost"
              size="sm"
              icon={Share2}
              onClick={() => void shareText(draft, video.topic)}
            >
              {t.share}
            </Button>
          )}
          {blockKey === 'cover' && (
            <Button
              variant="ghost"
              size="sm"
              icon={Image}
              onClick={() => {
                toast.info(t.coverStudioSoon);
                void navigate('/covers');
              }}
            >
              {t.openCoverStudio}
            </Button>
          )}
        </div>
      </section>
      <ConfirmDialog
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={() => {
          setConfirmGenerate(false);
          void run();
        }}
        title={t.replaceTitle}
        message={t.replaceText}
        confirmLabel={t.replace}
        variant="primary"
      />
    </Surface>
  );
}
