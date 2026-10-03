import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Download } from 'lucide-react';
import { Button, cn, Input, Select, Surface, Toggle, toast } from '@/components/ui';
import { Page } from '@/app/shell/Page';
import {
  checkCoverText,
  coverFileName,
  formatCoverVariants,
  parseCoverVariants,
  pickPoseFile,
  poseForCover,
  type CoverFormat,
} from '@/core/coverLayout';
import { selectBrand, videosRepo } from '@/data/repositories';
import type { Video } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import {
  COVER_RULES,
  COVER_TEXT_LIMITS,
  POSE_LABELS,
  POSE_MOODS,
  type PoseMood,
} from '@/data/templates';
import { de } from '@/i18n/de';
import { renderCoverPng, type CoverStyle } from '@/services/cover/render';
import { saveFile } from '@/services/share';
import { formatDate } from '@/features/videos/videoFormat';
import { setBlock } from '@/features/videos/videoActions';
import { CoverCanvas } from './CoverCanvas';
import { useCoverStyle } from './useCoverAssets';

const t = de.covers;
const FREE = '';
const AUTO = 'auto';
const SAVE_DELAY = 600;

function padVariants(variants: string[]): string[] {
  return Array.from({ length: COVER_TEXT_LIMITS.variants }, (_, index) => variants[index] ?? '');
}

function SaveButton({
  format,
  text,
  style,
}: {
  format: CoverFormat;
  text: string;
  style: CoverStyle;
}) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const blob = await renderCoverPng(format, text, style);
      const result = await saveFile(blob, coverFileName(format, text));
      if (result === 'downloaded') toast.success(t.downloaded);
    } catch {
      toast.error(t.saveFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={Download}
      loading={busy}
      disabled={busy || !text.trim()}
      onClick={() => void save()}
      data-testid={`cover-save-${format}`}
    >
      {t.save}
    </Button>
  );
}

/** Editor for one source (a video package or free text); keyed by the source. */
function CoverStudio({ video }: { video: Video | undefined }) {
  const brand = useDataStore(selectBrand);
  const [texts, setTexts] = useState(() =>
    padVariants(parseCoverVariants(video?.blocks.cover ?? '')),
  );
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(0);
  const [freePose, setFreePose] = useState<PoseMood | typeof AUTO>(AUTO);
  const [guide, setGuide] = useState(true);
  const videoId = video?.id;

  // Texts of a package are written back to its cover block (debounced, and on blur).
  const flush = () => {
    const current = videoId ? videosRepo.get(videoId) : undefined;
    if (!dirty || !current) return;
    void setBlock(current, 'cover', formatCoverVariants(texts));
    setDirty(false);
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => flushRef.current(), SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [texts, dirty]);

  const text = texts[selected] ?? '';
  const autoMood = poseForCover(text, video?.hookType);
  const poseChoice = video ? (video.coverPose ?? AUTO) : freePose;
  const mood = poseChoice === AUTO ? autoMood : poseChoice;
  const imageFileId = pickPoseFile(brand.poses, mood, brand.photoFileId);
  const { style, ready } = useCoverStyle(brand, imageFileId);

  const poseOptions = useMemo(
    () => [
      { value: AUTO, label: t.poseAuto(POSE_LABELS[autoMood]) },
      ...POSE_MOODS.map((value) => ({ value, label: POSE_LABELS[value] })),
    ],
    [autoMood],
  );

  const setPose = (value: string) => {
    const next = value === AUTO ? AUTO : (value as PoseMood);
    if (video) void videosRepo.update(video.id, { coverPose: next === AUTO ? undefined : next });
    else setFreePose(next);
  };

  const setText = (index: number, value: string) => {
    setTexts((current) =>
      current.map((item, i) => (i === index ? value.toLocaleUpperCase('de-DE') : item)),
    );
    setDirty(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="cover-variants">
        <div className="flex flex-col gap-1 px-1">
          <h2 id="cover-variants" className="text-lg font-semibold text-fg">
            {t.variants}
          </h2>
          <p className="text-sm text-fg-muted">
            {video ? (video.blocks.cover?.trim() ? t.fromBlock : t.emptyBlock) : t.variantsHint}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {texts.map((variant, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={selected === index}
              aria-label={t.choose(index + 1)}
              onClick={() => setSelected(index)}
              data-testid="cover-variant"
              className={cn(
                'flex min-h-11 flex-col items-center gap-2 rounded-xl p-1.5 transition-shadow',
                selected === index ? 'ring-3 ring-accent' : 'ring-1 ring-line',
              )}
            >
              <CoverCanvas
                format="reel"
                text={variant}
                style={style}
                ready={ready}
                label={t.variant(index + 1)}
                className="max-w-[11rem]"
              />
              <span className="text-sm font-medium text-fg-secondary">{t.variant(index + 1)}</span>
            </button>
          ))}
        </div>
        <Surface padding="sm" className="flex flex-col gap-3">
          {texts.map((variant, index) => {
            const check = checkCoverText(variant);
            return (
              <Input
                key={index}
                label={t.variant(index + 1)}
                placeholder={t.placeholder}
                value={variant}
                maxLength={80}
                autoCapitalize="characters"
                onFocus={() => setSelected(index)}
                onBlur={flush}
                onChange={(event) => setText(index, event.target.value)}
                hint={variant.trim() ? t.words(check.words) : undefined}
                error={check.tooLong ? t.tooLong : undefined}
                data-testid={`cover-text-${index + 1}`}
              />
            );
          })}
        </Surface>
      </section>

      <Surface padding="sm" className="grid gap-4 sm:grid-cols-2 sm:items-center">
        <Select
          label={t.pose}
          options={poseOptions}
          value={poseChoice}
          onChange={setPose}
          data-testid="cover-pose"
        />
        <Toggle label={t.guide} description={t.guideHint} checked={guide} onChange={setGuide} />
      </Surface>

      {!imageFileId && (
        <p
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-fg-muted"
          data-testid="cover-no-photo"
        >
          {t.noPhoto}
          <Link
            to="/brand"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-accent-fg"
          >
            {t.toBrand}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </p>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="cover-preview">
        <h2 id="cover-preview" className="px-1 text-lg font-semibold text-fg">
          {t.preview}
        </h2>
        <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {(['reel', 'thumbnail'] as const).map((format) => (
            <figure key={format} className="flex flex-col gap-2">
              <CoverCanvas
                format={format}
                text={text}
                style={style}
                ready={ready}
                guide={format === 'reel' && guide}
                label={t[format]}
                testId={`cover-${format}`}
                className={format === 'reel' ? 'mx-auto max-w-[18rem]' : undefined}
              />
              <figcaption className="flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-fg">{t[format]}</span>
                  <span className="text-sm text-fg-muted">
                    {format === 'reel' ? t.reelSize : t.thumbnailSize}
                  </span>
                </span>
                <SaveButton format={format} text={text} style={style} />
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="px-1 text-sm text-fg-muted">{t.saveHint}</p>
      </section>

      <details className="rounded-xl bg-surface-sunken p-4 text-sm text-fg-secondary">
        <summary className="min-h-11 cursor-pointer content-center font-medium text-fg">
          {t.rules}
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {COVER_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Cover studio: reel cover and YouTube thumbnail from three text variants. */
export function CoversPage() {
  const [params, setParams] = useSearchParams();
  const videosMap = useDataStore((s) => s.videos);
  const videoId = params.get('video') ?? FREE;
  const video = videoId ? videosMap[videoId] : undefined;

  const options = useMemo(() => {
    const all = Object.values(videosMap).sort((a, b) => {
      const doneA = a.status === 'published' ? 1 : 0;
      const doneB = b.status === 'published' ? 1 : 0;
      return doneA - doneB || a.date.localeCompare(b.date);
    });
    return [
      { value: FREE, label: t.noVideo },
      ...all.map((v) => ({ value: v.id, label: `${formatDate(v.date)} · ${v.topic}` })),
    ];
  }, [videosMap]);

  return (
    <Page title={t.title}>
      <div className="flex flex-col gap-6 pb-8">
        <Surface padding="sm" className="flex flex-col gap-2">
          <Select
            label={t.video}
            options={options}
            value={video ? video.id : FREE}
            onChange={(value) => setParams(value ? { video: value } : {}, { replace: true })}
            data-testid="cover-video"
          />
          {video && (
            <Link
              to={`/videos/${video.id}`}
              className="inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm font-medium text-accent-fg"
            >
              {t.toVideo}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </Surface>
        <CoverStudio key={video?.id ?? FREE} video={video} />
      </div>
    </Page>
  );
}
