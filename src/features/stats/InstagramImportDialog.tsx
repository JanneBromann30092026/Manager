import { useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { Button, Modal, toast } from '@/components/ui';
import { planApiImport } from '@/core/apiImport';
import { localDateOf } from '@/core/dates';
import { postsRepo } from '@/data/repositories';
import { de } from '@/i18n/de';
import { fetchInstagram, useInstagramToken, type InstagramFetchResult } from '@/services/instagram';
import { formatCount } from '@/features/connections/googleSignIn';
import { instagramErrorText } from '@/features/connections/instagramTexts';
import { applyImport, saveFollowerCount } from './statsActions';

const t = de.instagram;
const ti = t.import;

function Content({ onClose }: { onClose: () => void }) {
  const info = useInstagramToken((s) => s.info);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InstagramFetchResult | null>(null);

  const plans = result ? planApiImport(postsRepo.list(), result.drafts) : [];
  const created = plans.filter((plan) => plan.kind === 'create').length;

  const fetchNow = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await fetchInstagram());
    } catch (caught: unknown) {
      setError(instagramErrorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const done = await applyImport(plans, 'instagramApi');
      if (result.profile.followers_count !== undefined)
        await saveFollowerCount(
          'instagram',
          result.profile.followers_count,
          'instagramApi',
          localDateOf(),
        );
      toast.success(ti.done(done.created, done.updated));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-fg-secondary">{t.errors.noToken}</p>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center font-medium text-accent-fg"
        >
          {ti.toSettings}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="instagram-import">
      <p className="text-base text-fg-secondary">{ti.text}</p>
      {!result ? (
        <Button
          icon={Download}
          className="self-start"
          loading={busy}
          onClick={() => void fetchNow()}
          data-testid="instagram-fetch"
        >
          {busy ? ti.fetching : ti.fetch}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium text-fg" data-testid="instagram-profile">
            {ti.profile(
              result.profile.username ?? '–',
              formatCount(result.profile.followers_count),
            )}
          </p>
          {result.drafts.length === 0 ? (
            <p className="text-sm text-fg-secondary">{ti.none}</p>
          ) : (
            <p className="text-sm text-fg-secondary" data-testid="instagram-summary">
              {ti.summary(created, plans.length - created)}
            </p>
          )}
          {result.skipped > 0 && (
            <p className="text-sm text-fg-muted">{ti.skipped(result.skipped)}</p>
          )}
          {result.insightsFailed > 0 && (
            <p
              className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-fg"
              data-testid="instagram-insights-failed"
            >
              {ti.insightsFailed(result.insightsFailed)}
            </p>
          )}
          <p className="text-sm text-fg-muted">{ti.missing}</p>
          <Button
            className="self-start"
            loading={busy}
            onClick={() => void apply()}
            data-testid="instagram-apply"
          >
            {ti.apply}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger" data-testid="instagram-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Reads the newest reels and their insights from Instagram into „Zahlen“. */
export function InstagramImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={ti.title}>
      {open && <Content onClose={onClose} />}
    </Modal>
  );
}
