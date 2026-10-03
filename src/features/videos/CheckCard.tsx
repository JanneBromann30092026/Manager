import { useState } from 'react';
import { Check, CircleAlert, Send } from 'lucide-react';
import { Button, ConfirmDialog, Surface, cn, toast } from '@/components/ui';
import { checkVideo } from '@/core/videos';
import type { Video } from '@/data/schemas';
import { NO_ADVICE_HINT } from '@/data/templates';
import { de } from '@/i18n/de';
import { setBlock, setVideoStatus } from './videoActions';

const t = de.videos.check;

/** Rules check before "veröffentlicht" (the creator confirms; the app never publishes). */
export function CheckCard({ video }: { video: Video }) {
  const items = checkVideo(video);
  const open = items.filter((item) => !item.ok).length;
  const [confirming, setConfirming] = useState(false);

  const publish = async () => {
    await setVideoStatus(video, 'published');
    toast.success(t.published);
  };

  return (
    <Surface>
      <section className="flex flex-col gap-3" data-testid="video-check">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-fg">{t.title}</h2>
          <span
            className={cn('text-sm font-medium', open ? 'text-warning' : 'text-success')}
            data-testid="video-check-summary"
          >
            {open ? t.open(open) : t.allOk}
          </span>
        </div>
        <p className="text-sm text-fg-muted">{t.hint}</p>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5" data-ok={item.ok}>
              {item.ok ? (
                <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleAlert size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
              )}
              <span className={cn('text-base', item.ok ? 'text-fg-secondary' : 'text-fg')}>
                {t.items[item.key]}
              </span>
              {item.key === 'noAdvice' && !item.ok && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    void setBlock(
                      video,
                      'script',
                      `${(video.blocks.script ?? '').trimEnd()}\n\n${NO_ADVICE_HINT}`.trim(),
                    )
                  }
                >
                  {t.addNoAdvice}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {video.status !== 'published' && (
          <div>
            <Button
              icon={Send}
              variant={open ? 'secondary' : 'success'}
              onClick={() => (open ? setConfirming(true) : void publish())}
            >
              {t.publish}
            </Button>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await publish();
        }}
        title={t.publishTitle}
        message={t.publishText}
        confirmLabel={t.publishAnyway}
        variant="primary"
      />
    </Surface>
  );
}
