import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Archive, Download, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { Badge, Button, Modal, PasswordInput, toast } from '@/components/ui';
import { backupFileName, backupReminder, BACKUP_SETTING_KEYS } from '@/core/backup';
import { followersToCsv, postsToCsv } from '@/core/csvExport';
import { localDateOf } from '@/core/dates';
import { DATA_TABLES } from '@/data/db';
import { useDataStore } from '@/data/store';
import { de } from '@/i18n/de';
import {
  BackupError,
  createBackup,
  readBackup,
  restoreBackup,
  type BackupPreview,
} from '@/services/backup';
import { saveFile } from '@/services/share';
import { formatDate } from '@/features/videos/videoFormat';
import { isValidSetting, useSettings, type SettingKey } from './settingsStore';

const t = de.backup;

function errorText(error: unknown): string {
  return error instanceof BackupError ? t.errors[error.reason] : t.errors.failed;
}

const dateOf = (iso: string) => formatDate(localDateOf(new Date(iso)));

function CreateBackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; name: string; createdAt: string } | null>(null);

  const close = () => {
    if (busy) return;
    setPassword('');
    setError(undefined);
    setReady(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    try {
      const settings = useSettings.getState();
      const created = await createBackup(
        password,
        Object.fromEntries(BACKUP_SETTING_KEYS.map((key) => [key, settings[key]])),
      );
      setPassword('');
      setReady({
        blob: created.blob,
        name: backupFileName(localDateOf(new Date(created.createdAt))),
        createdAt: created.createdAt,
      });
    } catch (caught: unknown) {
      setError(
        caught instanceof BackupError && caught.reason === 'wrongPassword'
          ? t.wrongPassword
          : errorText(caught),
      );
    } finally {
      setBusy(false);
    }
  };

  // Saving needs its own tap: the share sheet only opens directly after a user gesture.
  const save = async () => {
    if (!ready) return;
    const result = await saveFile(ready.blob, ready.name);
    if (result === 'cancelled') {
      toast.info(t.cancelled);
      return;
    }
    await useSettings.getState().set('lastBackupAt', ready.createdAt);
    toast.success(result === 'shared' ? t.saved : t.downloaded);
    setReady(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.createTitle}
      description={t.createText}
      footer={
        ready ? (
          <Button icon={Download} onClick={() => void save()} data-testid="backup-save">
            {t.save}
          </Button>
        ) : (
          <Button
            type="submit"
            form="backup-create-form"
            icon={ShieldCheck}
            loading={busy}
            disabled={!password}
            data-testid="backup-encrypt"
          >
            {busy ? t.creating : t.create}
          </Button>
        )
      }
    >
      {ready ? (
        <p className="text-sm text-fg" role="status" data-testid="backup-ready">
          {ready.name}
        </p>
      ) : (
        <form id="backup-create-form" onSubmit={(event) => void submit(event)}>
          <PasswordInput
            label={t.password}
            value={password}
            error={error}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setError(undefined);
            }}
            data-testid="backup-password"
          />
        </form>
      )}
    </Modal>
  );
}

function RestoreBackupDialog({ file, onClose }: { file: File | null; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  const close = () => {
    if (busy) return;
    setPassword('');
    setError(undefined);
    setPreview(null);
    onClose();
  };

  const check = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || busy || !password) return;
    setBusy(true);
    try {
      setPreview(await readBackup(file, password));
      setPassword('');
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await restoreBackup(preview);
      const { set } = useSettings.getState();
      for (const [key, value] of Object.entries(preview.settings)) {
        if (isValidSetting(key as SettingKey, value)) await set(key as SettingKey, value as never);
      }
      toast.success(t.restored);
      setBusy(false);
      setPreview(null);
      onClose();
    } catch (caught: unknown) {
      toast.error(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const counts = preview
    ? ([...DATA_TABLES, 'files'] as const).filter((key) => preview.counts[key] > 0)
    : [];

  return (
    <Modal
      open={file !== null}
      onClose={close}
      title={preview ? t.previewTitle(dateOf(preview.createdAt)) : t.restoreTitle}
      description={preview ? undefined : t.restoreText}
      footer={
        preview ? (
          <Button
            variant="danger"
            icon={Upload}
            loading={busy}
            onClick={() => void replace()}
            data-testid="backup-replace"
          >
            {t.replace}
          </Button>
        ) : (
          <Button
            type="submit"
            form="backup-restore-form"
            icon={ShieldCheck}
            loading={busy}
            disabled={!password}
            data-testid="backup-check"
          >
            {busy ? t.checking : t.check}
          </Button>
        )
      }
    >
      {preview ? (
        <div className="flex flex-col gap-3" data-testid="backup-preview">
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {counts.map((key) => (
              <li
                key={key}
                className="flex justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2"
              >
                <span className="text-fg-secondary">{t.counts[key]}</span>
                <span className="font-semibold text-fg tabular-nums">{preview.counts[key]}</span>
              </li>
            ))}
          </ul>
          {preview.skipped > 0 && (
            <p className="text-sm text-warning">{t.skipped(preview.skipped)}</p>
          )}
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-fg" role="note">
            {t.replaceWarning}
          </p>
        </div>
      ) : (
        <form
          id="backup-restore-form"
          className="flex flex-col gap-3"
          onSubmit={(event) => void check(event)}
        >
          {file && <p className="text-sm text-fg-secondary">{t.fileLabel(file.name)}</p>}
          <PasswordInput
            label={t.password}
            value={password}
            error={error}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setError(undefined);
            }}
            data-testid="backup-restore-password"
          />
        </form>
      )}
    </Modal>
  );
}

function csvName(kind: string): string {
  return `manager-${kind}-${localDateOf()}.csv`;
}

/** Backup (export/import, encrypted) and CSV export of the numbers. */
export function BackupSettings() {
  const lastBackupAt = useSettings((s) => s.lastBackupAt);
  const posts = useDataStore((s) => s.posts);
  const stats = useDataStore((s) => s.accountStats);
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('backup') === '1');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get('backup') !== '1') return;
    const next = new URLSearchParams(params);
    next.delete('backup');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const postList = Object.values(posts);
  const statList = Object.values(stats);

  const exportCsv = async (text: string, name: string) => {
    const result = await saveFile(new Blob([text], { type: 'text/csv;charset=utf-8' }), name);
    if (result !== 'cancelled') toast.success(t.csvSaved);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="backup-settings">
      <p className="text-sm text-fg-secondary">{t.intro}</p>
      <div>
        <Badge tone={lastBackupAt ? 'success' : 'warning'}>
          <span data-testid="backup-last">
            {lastBackupAt ? t.last(dateOf(lastBackupAt)) : t.never}
          </span>
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={Archive} onClick={() => setCreating(true)} data-testid="backup-create">
          {t.create}
        </Button>
        <Button
          variant="secondary"
          icon={Upload}
          onClick={() => fileInput.current?.click()}
          data-testid="backup-restore"
        >
          {t.restore}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.chooseFile}
          data-testid="backup-file"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            setRestoreFile(file);
          }}
        />
      </div>

      <div className="h-px bg-line" />
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-fg">{t.csv}</h3>
        <p className="text-sm text-fg-muted">
          {postList.length + statList.length === 0 ? t.csvEmpty : t.csvHint}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={FileSpreadsheet}
          disabled={postList.length === 0}
          onClick={() => void exportCsv(postsToCsv(postList), csvName('beitraege'))}
          data-testid="csv-posts"
        >
          {t.csvPosts}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={FileSpreadsheet}
          disabled={statList.length === 0}
          onClick={() => void exportCsv(followersToCsv(statList), csvName('follower'))}
          data-testid="csv-followers"
        >
          {t.csvFollowers}
        </Button>
      </div>

      <CreateBackupDialog open={creating} onClose={() => setCreating(false)} />
      <RestoreBackupDialog file={restoreFile} onClose={() => setRestoreFile(null)} />
    </div>
  );
}

/** Start page: reminds to export a backup (never or more than 14 days ago). */
export function BackupReminder() {
  const lastBackupAt = useSettings((s) => s.lastBackupAt);
  const hasData = useDataStore(
    (s) =>
      Object.keys(s.posts).length + Object.keys(s.videos).length + Object.keys(s.ideas).length > 0,
  );
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const reminder = backupReminder(lastBackupAt, now, hasData);
  if (!reminder.due) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-signal-soft px-4 py-3 text-sm text-fg wide:col-span-2"
      data-testid="backup-reminder"
    >
      <span>{t.reminder(reminder.days)}</span>
      <Button
        size="sm"
        variant="secondary"
        icon={Archive}
        onClick={() => void navigate('/settings?backup=1')}
      >
        {t.reminderAction}
      </Button>
    </div>
  );
}
