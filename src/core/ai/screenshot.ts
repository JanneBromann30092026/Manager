/**
 * Reading statistics screenshots with Claude: the prompt and the strict parsing of the answer.
 * Only values Claude reports are taken; everything else stays empty. The creator confirms the
 * values before they are saved (marked „abgelesen“).
 */
import { z } from 'zod';
import { parseDate, type PostDraft } from '../csvImport';

export const SCREENSHOT_FIELDS = [
  'views',
  'nonFollowerPct',
  'avgWatchSeconds',
  'likes',
  'comments',
  'shares',
  'saves',
  'newFollowers',
  'lengthSeconds',
  'halfGoneSeconds',
  'endHoldPct',
  'stories',
  'reelsTab',
  'feed',
  'profile',
  'explore',
] as const;

export const SCREENSHOT_PROMPT = [
  'Lies die Zahlen aus diesem Screenshot einer Instagram- oder YouTube-Statistik eines einzelnen Beitrags ab.',
  'Antworte NUR mit einem JSON-Objekt, ohne Erklärung. Erlaubte Schlüssel (alle optional):',
  'platform ("instagram"|"youtube"), format ("reel"|"story"|"video"|"short"|"podcast"|"clip"), date ("JJJJ-MM-TT", Veröffentlichung), topic (Titel/Thema),',
  'views, likes, comments, shares, saves, newFollowers (ganze Zahlen),',
  'nonFollowerPct (Anteil Nicht-Follower in %), avgWatchSeconds (Ø Wiedergabedauer in Sekunden),',
  'lengthSeconds (Videolänge in Sekunden), halfGoneSeconds (Sekunde, bei der 50 % weg sind), endHoldPct (% am Ende noch dabei),',
  'stories, reelsTab, feed, profile, explore (Quellen der Aufrufe in %).',
  'Nimm nur Werte auf, die im Bild eindeutig zu lesen sind. Nichts schätzen oder berechnen; unklare Werte weglassen.',
  'Schreibweise wie „1.357“ oder „1,2K“ in die echte Zahl umrechnen (1357, 1200).',
].join('\n');

const num = z
  .preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.coerce.number().finite().min(0).optional(),
  )
  .catch(undefined);
const answerSchema = z.object({
  platform: z.enum(['instagram', 'youtube']).optional().catch(undefined),
  format: z
    .enum(['reel', 'story', 'video', 'short', 'podcast', 'clip'])
    .optional()
    .catch(undefined),
  date: z.string().optional().catch(undefined),
  topic: z.string().max(200).optional().catch(undefined),
  ...Object.fromEntries(SCREENSHOT_FIELDS.map((field) => [field, num])),
});

const PERCENT = new Set([
  'nonFollowerPct',
  'endHoldPct',
  'stories',
  'reelsTab',
  'feed',
  'profile',
  'explore',
]);
const RETENTION = new Set(['lengthSeconds', 'halfGoneSeconds', 'endHoldPct']);
const SOURCES = new Set(['stories', 'reelsTab', 'feed', 'profile', 'explore']);
const INTEGER = new Set(['views', 'likes', 'comments', 'shares', 'saves', 'newFollowers']);

/** Parses Claude's answer; returns the read values and which fields they are. */
export function parseScreenshotAnswer(answer: string): {
  draft: Partial<PostDraft>;
  readFields: string[];
} {
  const match = /\{[\s\S]*\}/.exec(answer);
  if (!match) return { draft: {}, readFields: [] };
  let json: unknown;
  try {
    json = JSON.parse(match[0]);
  } catch {
    return { draft: {}, readFields: [] };
  }
  const parsed = answerSchema.safeParse(json);
  if (!parsed.success) return { draft: {}, readFields: [] };
  const data = parsed.data as Record<string, unknown>;
  const draft: Partial<PostDraft> & Record<string, unknown> = {};
  const numbers = draft as Record<string, number>;
  const readFields: string[] = [];
  const retention: Record<string, unknown> = {};
  const sources: Record<string, number> = {};

  if (data.platform) draft.platform = data.platform as PostDraft['platform'];
  if (data.format) draft.format = data.format as PostDraft['format'];
  const date = typeof data.date === 'string' ? parseDate(data.date) : undefined;
  if (date) draft.date = date;
  if (typeof data.topic === 'string' && data.topic.trim()) draft.topic = data.topic.trim();

  for (const field of SCREENSHOT_FIELDS) {
    const raw = data[field];
    if (typeof raw !== 'number') continue;
    let value: number = raw;
    if (PERCENT.has(field) && value > 100) continue;
    if (INTEGER.has(field)) value = Math.round(value);
    readFields.push(field);
    if (SOURCES.has(field)) sources[field] = value;
    else if (RETENTION.has(field)) retention[field] = value;
    else numbers[field] = value;
  }
  if (Object.keys(sources).length > 0) retention.sources = sources;
  if (Object.keys(retention).length > 0) draft.retention = retention;
  return { draft, readFields };
}
