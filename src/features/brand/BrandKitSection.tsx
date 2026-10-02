import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2, Type, Upload } from 'lucide-react';
import { Button, IconButton, Input, Select, toast } from '@/components/ui';
import { brandRepo, filesRepo, FileTooLargeError } from '@/data/repositories';
import type { FileKind } from '@/data/domain';
import type { Brand, Pose } from '@/data/schemas';
import {
  BRAND_COLOR_KEYS,
  BRAND_COLOR_LABELS,
  FONT_EXTENSIONS,
  POSE_LABELS,
  POSE_MOODS,
  type BrandColorKey,
  type PoseMood,
} from '@/data/templates';
import { de } from '@/i18n/de';
import { BRAND_FONT_FAMILY, parseFont, useBrandFont } from './brandFont';
import { useFileUrl } from './useFileUrl';

const t = de.brand.kit;

const HEX = /^#[0-9a-fA-F]{6}$/;

const moodOptions = POSE_MOODS.map((mood) => ({ value: mood, label: POSE_LABELS[mood] }));

function SubHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {hint && <p className="text-sm text-fg-muted">{hint}</p>}
    </div>
  );
}

/** Stores a picked file encrypted; shows a toast on errors. Returns the new file id. */
async function storeFile(kind: FileKind, file: File): Promise<string | null> {
  try {
    const stored = await filesRepo.put(kind, file, file.name);
    return stored.id;
  } catch (error: unknown) {
    toast.error(error instanceof FileTooLargeError ? t.tooLarge : de.errors.title);
    return null;
  }
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

/** Hidden file input behind a button (iPad: Photos, Files). */
function FilePicker({
  accept,
  label,
  icon,
  variant = 'secondary',
  onPick,
  testId,
}: {
  accept: string;
  label: string;
  icon: typeof Upload;
  variant?: 'secondary' | 'ghost';
  onPick: (file: File) => Promise<void>;
  testId: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const change = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await onPick(file);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void change(event)}
        data-testid={testId}
      />
      <Button
        variant={variant}
        size="sm"
        icon={icon}
        loading={busy}
        onClick={() => ref.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}

function ColorRow({ colorKey, value }: { colorKey: BrandColorKey; value: string }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }

  const save = (next: string, delay: number) => {
    window.clearTimeout(timer.current);
    if (!HEX.test(next)) return;
    timer.current = window.setTimeout(() => {
      const brand = brandRepo.get();
      void brandRepo.update({ colors: { ...brand.colors, [colorKey]: next } });
    }, delay);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const valid = HEX.test(draft);
  return (
    <div className="flex items-end gap-3" data-testid={`brand-color-${colorKey}`}>
      <input
        type="color"
        aria-label={t.colorPicker(BRAND_COLOR_LABELS[colorKey])}
        value={valid ? draft.toLowerCase() : value.toLowerCase()}
        onChange={(event) => {
          const next = event.target.value.toUpperCase();
          setDraft(next);
          save(next, 300);
        }}
        className="mb-1 size-11 shrink-0 cursor-pointer rounded-xl border border-line bg-transparent p-0.5"
      />
      <Input
        label={BRAND_COLOR_LABELS[colorKey]}
        value={draft}
        maxLength={7}
        autoCapitalize="characters"
        spellCheck={false}
        error={valid ? undefined : t.colorInvalid}
        onChange={(event) => {
          const next = event.target.value.trim().toUpperCase();
          setDraft(next);
          save(next, 500);
        }}
        className="font-mono"
      />
    </div>
  );
}

/** Cover-like preview: gradient, accent lines, two lines of text, photo on the right. */
function Preview({ brand }: { brand: Brand }) {
  const fontReady = useBrandFont(brand.fontFileId);
  const photo = useFileUrl(brand.photoFileId);
  const { colors } = brand;
  const [first, second] = splitPreview(t.previewText);
  return (
    <div
      data-testid="brand-preview"
      className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-card"
      style={{
        background: `linear-gradient(to top right, ${colors.deep}, ${colors.main} 55%, ${colors.light})`,
      }}
    >
      <div
        className="absolute top-[12%] left-[6%] h-1 w-1/4 rounded-full"
        style={{ background: colors.accent }}
      />
      <div
        className="absolute bottom-[12%] left-[6%] h-1 w-1/6 rounded-full"
        style={{ background: colors.accent }}
      />
      <div
        className="absolute top-1/2 left-[6%] max-w-[55%] -translate-y-1/2 text-[clamp(1.25rem,5vw,2.5rem)] leading-[1.05] font-black tracking-tight uppercase"
        style={{
          color: colors.text,
          fontFamily: fontReady ? `"${BRAND_FONT_FAMILY}", Inter, sans-serif` : undefined,
        }}
      >
        <div>{first}</div>
        <div>{second}</div>
      </div>
      {photo && (
        <img
          src={photo}
          alt=""
          className="absolute right-[4%] bottom-0 h-[92%] w-auto object-contain"
        />
      )}
    </div>
  );
}

function splitPreview(text: string): [string, string] {
  const words = text.split(' ');
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}

function useFileName(fileId: string | undefined): string | null {
  const [name, setName] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let active = true;
    void filesRepo.list('font').then((files) => {
      const file = files.find((f) => f.id === fileId);
      if (active && file) setName({ id: fileId, name: file.name });
    });
    return () => {
      active = false;
    };
  }, [fileId]);
  return fileId && name?.id === fileId ? name.name : null;
}

function PoseCard({
  pose,
  onMood,
  onRemove,
}: {
  pose: Pose;
  onMood: (mood: PoseMood) => void;
  onRemove: () => void;
}) {
  const url = useFileUrl(pose.fileId);
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface-sunken p-3" data-testid="brand-pose">
      <div className="relative flex aspect-square items-end justify-center overflow-hidden rounded-xl bg-[linear-gradient(to_top_right,var(--brand-deep),var(--brand-light))]">
        {url && (
          <img src={url} alt={POSE_LABELS[pose.mood]} className="h-full w-full object-contain" />
        )}
        <IconButton
          icon={Trash2}
          label={t.poseRemove}
          variant="secondary"
          className="absolute top-1.5 right-1.5"
          onClick={onRemove}
        />
      </div>
      <Select label={t.poseMood} options={moodOptions} value={pose.mood} onChange={onMood} />
    </li>
  );
}

/** Colors, cover font, cut-out photo and poses – all files stored encrypted. */
export function BrandKitSection({ brand }: { brand: Brand }) {
  const fontName = useFileName(brand.fontFileId);
  const photo = useFileUrl(brand.photoFileId);

  const replaceFile = async (field: 'fontFileId' | 'photoFileId', id: string | undefined) => {
    const previous = brand[field];
    await brandRepo.update({ [field]: id });
    if (previous && previous !== id) await filesRepo.remove(previous);
  };

  const pickFont = async (file: File) => {
    try {
      await parseFont(await file.arrayBuffer());
    } catch {
      toast.error(t.fontInvalid);
      return;
    }
    const id = await storeFile('font', file);
    if (!id) return;
    await replaceFile('fontFileId', id);
    toast.success(t.uploaded);
  };

  const pickPhoto = async (file: File) => {
    if (!isImage(file)) {
      toast.error(t.wrongType);
      return;
    }
    const id = await storeFile('photo', file);
    if (!id) return;
    await replaceFile('photoFileId', id);
    toast.success(t.uploaded);
  };

  const addPose = async (file: File) => {
    if (!isImage(file)) {
      toast.error(t.wrongType);
      return;
    }
    const id = await storeFile('pose', file);
    if (!id) return;
    const current = brandRepo.get();
    await brandRepo.update({ poses: [...current.poses, { fileId: id, mood: 'neutral' }] });
    toast.success(t.uploaded);
  };

  const updatePose = async (fileId: string, mood: PoseMood) => {
    const current = brandRepo.get();
    await brandRepo.update({
      poses: current.poses.map((pose) => (pose.fileId === fileId ? { ...pose, mood } : pose)),
    });
  };

  const removePose = async (fileId: string) => {
    const current = brandRepo.get();
    await brandRepo.update({ poses: current.poses.filter((pose) => pose.fileId !== fileId) });
    await filesRepo.remove(fileId);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SubHeading title={t.preview} />
        <Preview brand={brand} />
      </div>

      <div className="h-px bg-line" />
      <div className="flex flex-col gap-3">
        <SubHeading title={t.colors} />
        <div className="grid gap-3 wide:grid-cols-2">
          {BRAND_COLOR_KEYS.map((key) => (
            <ColorRow key={key} colorKey={key} value={brand.colors[key]} />
          ))}
        </div>
      </div>

      <div className="h-px bg-line" />
      <div className="flex flex-col gap-3">
        <SubHeading title={t.font} hint={t.fontHint} />
        <p className="text-base text-fg" data-testid="brand-font-name">
          {brand.fontFileId ? (fontName ?? '…') : t.fontNone}
        </p>
        <div className="flex flex-wrap gap-2">
          <FilePicker
            accept={[...FONT_EXTENSIONS, 'font/*'].join(',')}
            label={brand.fontFileId ? t.fontReplace : t.fontUpload}
            icon={Type}
            onPick={pickFont}
            testId="brand-font-input"
          />
          {brand.fontFileId && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => void replaceFile('fontFileId', undefined)}
            >
              {t.fontRemove}
            </Button>
          )}
        </div>
      </div>

      <div className="h-px bg-line" />
      <div className="flex flex-col gap-3">
        <SubHeading title={t.photo} hint={t.photoHint} />
        {photo && (
          <img
            src={photo}
            alt={t.photo}
            data-testid="brand-photo"
            className="h-40 w-40 rounded-2xl bg-[linear-gradient(to_top_right,var(--brand-deep),var(--brand-light))] object-contain"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <FilePicker
            accept="image/*"
            label={t.photoUpload}
            icon={Upload}
            onPick={pickPhoto}
            testId="brand-photo-input"
          />
          {brand.photoFileId && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => void replaceFile('photoFileId', undefined)}
            >
              {t.photoRemove}
            </Button>
          )}
        </div>
      </div>

      <div className="h-px bg-line" />
      <div className="flex flex-col gap-3">
        <SubHeading title={t.poses} hint={t.posesHint} />
        {brand.poses.length === 0 ? (
          <p className="text-sm text-fg-muted">{t.posesEmpty}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 wide:grid-cols-3">
            {brand.poses.map((pose) => (
              <PoseCard
                key={pose.fileId}
                pose={pose}
                onMood={(mood) => void updatePose(pose.fileId, mood)}
                onRemove={() => void removePose(pose.fileId)}
              />
            ))}
          </ul>
        )}
        <div>
          <FilePicker
            accept="image/*"
            label={t.poseUpload}
            icon={ImagePlus}
            onPick={addPose}
            testId="brand-pose-input"
          />
        </div>
      </div>
    </div>
  );
}
