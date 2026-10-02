import { useState } from 'react';
import { Input, Textarea, toast } from '@/components/ui';
import { brandRepo } from '@/data/repositories';
import type { Brand, Channel } from '@/data/schemas';
import { de } from '@/i18n/de';
import { EditableCard } from './EditableCard';
import { lines } from './lines';

const t = de.brand;

const TEXT_FIELDS = [
  'name',
  'platforms',
  'topics',
  'positioning',
  'bioCore',
  'tone',
  'style',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Draft = Record<TextField, string> & { frame: string };

function toDraft(channel: Channel): Draft {
  return {
    name: channel.name,
    platforms: channel.platforms,
    topics: channel.topics,
    positioning: channel.positioning,
    bioCore: channel.bioCore,
    tone: channel.tone,
    style: channel.style,
    frame: lines.join(channel.frame),
  };
}

/** Channel profile: readable, editable. */
export function ChannelSection({ brand }: { brand: Brand }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const { channel } = brand;

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return;
    await brandRepo.update({ channel: { ...draft, frame: lines.split(draft.frame) } });
    setDraft(null);
    toast.success(t.saved);
  };

  return (
    <EditableCard
      testId="brand-channel"
      editing={draft !== null}
      onEdit={() => setDraft(toDraft(channel))}
      onCancel={() => setDraft(null)}
      onSave={() => void save()}
      view={
        <dl className="grid gap-x-6 gap-y-3 wide:grid-cols-[10rem_1fr]">
          {TEXT_FIELDS.map((field) => (
            <div key={field} className="contents">
              <dt className="text-sm text-fg-secondary">{t.channel[field]}</dt>
              <dd className="text-base text-fg">{channel[field] || '–'}</dd>
            </div>
          ))}
          <dt className="text-sm text-fg-secondary">{t.channel.frame}</dt>
          <dd>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-fg">
              {channel.frame.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </dd>
        </dl>
      }
      form={
        draft && (
          <>
            {TEXT_FIELDS.map((field) =>
              field === 'name' || field === 'platforms' || field === 'bioCore' ? (
                <Input
                  key={field}
                  label={t.channel[field]}
                  value={draft[field]}
                  required={field === 'name'}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                />
              ) : (
                <Textarea
                  key={field}
                  label={t.channel[field]}
                  rows={2}
                  value={draft[field]}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                />
              ),
            )}
            <Textarea
              label={t.channel.frame}
              hint={t.listHint}
              rows={4}
              value={draft.frame}
              onChange={(event) => setDraft({ ...draft, frame: event.target.value })}
            />
          </>
        )
      }
    />
  );
}
