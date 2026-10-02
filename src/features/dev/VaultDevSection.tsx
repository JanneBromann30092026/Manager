import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Surface, toast } from '@/components/ui';
import { VIDEO_STATUSES } from '@/data/domain';
import { videosRepo } from '@/data/repositories';
import { devRepo, type RawPreview } from '@/data/repositories/devRepo';
import { useDataStore } from '@/data/store';
import { de } from '@/i18n/de';

const t = de.dev.vault;

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length] as T;
}

function Stat({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-sunken px-4 py-3">
      <span className="text-sm text-fg-secondary">{label}</span>
      <span className="text-xl font-semibold text-fg tabular-nums" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

/** Creates, changes and deletes invented video packages to check the encryption. */
export function VaultDevSection() {
  const videos = useDataStore((s) => s.videos);
  const [raw, setRaw] = useState<RawPreview | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const list = Object.values(videos).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newest = list[0];

  // Refresh the raw view whenever the decrypted data changes (also from other tabs).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([devRepo.newestVideoRow(), devRepo.counts()]).then(([row, counts]) => {
      if (cancelled) return;
      setRaw(row);
      setFileCount(counts.files ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [videos]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      toast.success(await action());
    } catch {
      toast.error(de.lock.errors.failed);
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const video = await videosRepo.create({
        date: new Date().toISOString().slice(0, 10),
        topic: pick(t.testTopics, list.length),
        status: 'script',
        demo: true,
      });
      return t.created(video.topic);
    });

  const update = () =>
    run(async () => {
      if (!newest) return '';
      const index = VIDEO_STATUSES.indexOf(newest.status) + 1;
      const updated = await videosRepo.update(newest.id, { status: pick(VIDEO_STATUSES, index) });
      return t.updated(updated.topic);
    });

  const remove = () =>
    run(async () => {
      if (!newest) return '';
      await videosRepo.remove(newest.id);
      return t.removed(newest.topic);
    });

  return (
    <section className="flex flex-col gap-3" data-testid="dev-section-vault">
      <h2 className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
        {t.title}
      </h2>
      <Surface className="flex flex-col gap-5">
        <p className="text-base text-fg-secondary">{t.hint}</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t.videos} value={list.length} testId="vault-video-count" />
          <Stat label={t.files} value={fileCount} testId="vault-file-count" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button icon={Plus} onClick={() => void create()} loading={busy}>
            {t.create}
          </Button>
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => void update()}
            disabled={!newest || busy}
          >
            {t.update}
          </Button>
          <Button
            variant="secondary"
            icon={Trash2}
            onClick={() => void remove()}
            disabled={!newest || busy}
          >
            {t.remove}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-fg-secondary">{t.decrypted}</h3>
            {list.length === 0 && <p className="text-sm text-fg-muted">{t.empty}</p>}
            <ul className="flex flex-col gap-1.5" data-testid="vault-videos">
              {list.slice(0, 5).map((video) => (
                <li key={video.id} className="flex items-center gap-2 text-base text-fg">
                  <Badge tone="accent">{t.statuses[VIDEO_STATUSES.indexOf(video.status)]}</Badge>
                  <span className="truncate">{video.topic}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm font-semibold text-fg-secondary">{t.stored}</h3>
            {raw ? (
              <dl
                className="flex flex-col gap-1 font-mono text-xs break-all text-fg-secondary"
                data-testid="vault-raw"
              >
                <dt className="text-fg-muted">id</dt>
                <dd>{raw.id}</dd>
                <dt className="text-fg-muted">{t.iv}</dt>
                <dd>{raw.iv}</dd>
                <dt className="text-fg-muted">
                  {t.ciphertext} ({t.bytes(raw.bytes)})
                </dt>
                <dd>{raw.ciphertext}…</dd>
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">{t.empty}</p>
            )}
          </div>
        </div>
      </Surface>
    </section>
  );
}
