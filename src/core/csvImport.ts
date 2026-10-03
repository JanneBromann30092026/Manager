/**
 * CSV import of posts (performance.csv) and retention (retention.csv). Columns are recognized
 * by name (German or English, case and umlauts ignored); unknown columns are reported, unknown
 * values stay empty. Rows are merged into existing posts by date + platform + topic.
 */
import type { Format, HookType, Platform } from '@/data/domain';

// --- CSV parsing ---------------------------------------------------------------

/** Splits CSV text into rows (quotes, escaped quotes, line breaks in quotes; ; , or tab). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]!;
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

const EMPTY = new Set(['', '-', '–', '—', 'n/a', 'na', 'k.a.', 'ka', '?']);

/**
 * German or English number: "1.357" = 1357, "4,9" = 4.9, "1,234.5", "53 %", "0:45" (m:ss →
 * 45 seconds). Empty or unreadable → undefined (never guessed).
 */
export function parseNumber(raw: string): number | undefined {
  const text = raw.trim().toLowerCase();
  if (EMPTY.has(text)) return undefined;
  const time = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (time) return Number(time[1]) * 60 + Number(time[2]);
  let value = text.replace(/[\s%€]|sek\.?|sec|s$/g, '');
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    value =
      lastComma > lastDot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (lastComma >= 0) {
    value =
      /^\d{1,3}(,\d{3})+$/.test(value) && !/^0,/.test(value)
        ? value.replace(/,/g, '')
        : value.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) return undefined;
  return Number(value);
}

/** "2026-09-28", "28.09.2026", "28.09.26" or "28/09/2026" → "2026-09-28". */
export function parseDate(raw: string): string | undefined {
  const text = raw.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  let year: number;
  let month: number;
  let day: number;
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/.exec(text);
    if (!match) return undefined;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (year < 100) year += 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}

/** Lowercase, umlauts written out, only letters and digits. */
export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

// --- Column recognition --------------------------------------------------------

export const IMPORT_FIELDS = [
  'date',
  'platform',
  'format',
  'topic',
  'hookType',
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
  'notes',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

const ALIASES: Record<ImportField, readonly string[]> = {
  date: ['datum', 'date', 'veroeffentlicht', 'veroeffentlichtam', 'published', 'tag'],
  platform: ['plattform', 'platform', 'kanal', 'channel'],
  format: ['format', 'typ', 'type', 'art', 'beitragsart'],
  topic: ['thema', 'topic', 'titel', 'title', 'beitrag', 'video', 'reel'],
  hookType: ['hook', 'hooktyp', 'hooktype', 'hookart'],
  views: ['aufrufe', 'views', 'plays', 'wiedergaben', 'impressions'],
  nonFollowerPct: [
    'nichtfollower',
    'nichtfollowerprozent',
    'nichtfollowerpct',
    'nonfollower',
    'nonfollowers',
    'nonfollowerpct',
    'nonfollowerprozent',
  ],
  avgWatchSeconds: [
    'wiedergabedauer',
    'durchschnwiedergabedauer',
    'durchschnittlichewiedergabedauer',
    'wiedergabedauersek',
    'avgwatch',
    'avgwatchtime',
    'avgwatchseconds',
    'watchtime',
  ],
  likes: ['likes', 'gefaelltmir', 'gefaelltmirangaben'],
  comments: ['kommentare', 'comments', 'kommentar'],
  shares: ['shares', 'geteilt', 'teilen', 'sends'],
  saves: ['saves', 'gespeichert', 'speichern', 'saved'],
  newFollowers: [
    'neuefollower',
    'newfollowers',
    'follows',
    'followergewonnen',
    'gewonnenefollower',
    'follower',
    'abonnenten',
    'abonnentengewonnen',
  ],
  lengthSeconds: ['laenge', 'length', 'dauer', 'videolaenge', 'laengesek', 'lengthseconds'],
  halfGoneSeconds: [
    'sekbis50',
    'sekbis50weg',
    'bis50',
    'bis50weg',
    'sekundenbis50',
    'halfgone',
    'halfgoneseconds',
    'sec50',
  ],
  endHoldPct: ['haltenamende', 'haltenende', 'endhold', 'endholdpct', 'amende', 'endeprozent'],
  stories: ['stories', 'story', 'quellestories'],
  reelsTab: ['reelstab', 'reels', 'quellereels'],
  feed: ['feed', 'quellefeed'],
  profile: ['profil', 'profile', 'quelleprofil'],
  explore: ['explore', 'entdecken', 'quelleexplore'],
  notes: ['notizen', 'notiz', 'notes', 'bemerkung', 'anmerkung'],
};

const ALIAS_INDEX = new Map<string, ImportField>(
  IMPORT_FIELDS.flatMap((field) => ALIASES[field].map((alias) => [alias, field] as const)),
);

/** Field per column (undefined = unknown column). */
export function recognizeColumns(header: readonly string[]): (ImportField | undefined)[] {
  const used = new Set<ImportField>();
  return header.map((name) => {
    const key = normalizeKey(name.replace(/\(.*?\)/g, ''));
    const field =
      ALIAS_INDEX.get(key) ?? ALIAS_INDEX.get(key.replace(/(prozent|pct|sek|sekunden|s)$/, ''));
    if (!field || used.has(field)) return undefined;
    used.add(field);
    return field;
  });
}

const PLATFORM_VALUES: Record<string, Platform> = {
  instagram: 'instagram',
  ig: 'instagram',
  insta: 'instagram',
  youtube: 'youtube',
  yt: 'youtube',
};

const FORMAT_VALUES: Record<string, Format> = {
  reel: 'reel',
  reels: 'reel',
  story: 'story',
  stories: 'story',
  video: 'video',
  youtubevideo: 'video',
  longform: 'video',
  short: 'short',
  shorts: 'short',
  podcast: 'podcast',
  folge: 'podcast',
  episode: 'podcast',
  podcastfolge: 'podcast',
  clip: 'clip',
  podcastclip: 'clip',
};

const HOOK_VALUES: Record<string, HookType> = {
  frage: 'question',
  question: 'question',
  zahl: 'number',
  number: 'number',
  widerspruch: 'contradiction',
  contradiction: 'contradiction',
};

// --- Rows → post drafts --------------------------------------------------------

export interface PostDraft {
  date: string;
  platform: Platform;
  format: Format;
  topic?: string;
  hookType?: HookType;
  views?: number;
  nonFollowerPct?: number;
  avgWatchSeconds?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  newFollowers?: number;
  retention?: {
    lengthSeconds?: number;
    halfGoneSeconds?: number;
    endHoldPct?: number;
    sources?: {
      stories?: number;
      reelsTab?: number;
      feed?: number;
      profile?: number;
      explore?: number;
    };
  };
  notes?: string;
}

export type ImportErrorCode = 'date' | 'value';

export interface ImportResult {
  drafts: { line: number; draft: PostDraft }[];
  errors: { line: number; code: ImportErrorCode; column?: string }[];
  recognized: ImportField[];
  unknownColumns: string[];
}

const COUNT_FIELDS = ['views', 'likes', 'comments', 'shares', 'saves', 'newFollowers'] as const;
const PERCENT_FIELDS = ['nonFollowerPct'] as const;
const RETENTION_FIELDS = ['lengthSeconds', 'halfGoneSeconds', 'endHoldPct'] as const;
const SOURCE_FIELDS = ['stories', 'reelsTab', 'feed', 'profile', 'explore'] as const;

function inRange(value: number, max: number): boolean {
  return value >= 0 && value <= max;
}

export function importPostsCsv(
  text: string,
  defaults: { platform: Platform; format: Format } = { platform: 'instagram', format: 'reel' },
): ImportResult {
  const [header = [], ...rows] = parseCsv(text);
  const columns = recognizeColumns(header);
  const result: ImportResult = {
    drafts: [],
    errors: [],
    recognized: columns.filter((field): field is ImportField => field !== undefined),
    unknownColumns: header.filter((_, index) => !columns[index]).map((name) => name.trim()),
  };

  rows.forEach((cells, rowIndex) => {
    const line = rowIndex + 2;
    const values = new Map<ImportField, string>();
    columns.forEach((field, index) => {
      if (field) values.set(field, (cells[index] ?? '').trim());
    });
    const date = parseDate(values.get('date') ?? '');
    if (!date) {
      result.errors.push({ line, code: 'date' });
      return;
    }
    const draft: PostDraft = {
      date,
      platform: PLATFORM_VALUES[normalizeKey(values.get('platform') ?? '')] ?? defaults.platform,
      format: FORMAT_VALUES[normalizeKey(values.get('format') ?? '')] ?? defaults.format,
    };
    const topic = values.get('topic');
    if (topic) draft.topic = topic.slice(0, 200);
    const hook = normalizeKey(values.get('hookType') ?? '');
    if (hook) draft.hookType = HOOK_VALUES[hook] ?? 'other';
    const notes = values.get('notes');
    if (notes) draft.notes = notes.slice(0, 2000);

    const number = (field: ImportField, max: number, integer = false): number | undefined => {
      const raw = values.get(field);
      if (raw === undefined) return undefined;
      const value = parseNumber(raw);
      if (value === undefined) {
        if (!EMPTY.has(raw.trim().toLowerCase())) {
          result.errors.push({ line, code: 'value', column: field });
        }
        return undefined;
      }
      if (!inRange(value, max)) {
        result.errors.push({ line, code: 'value', column: field });
        return undefined;
      }
      return integer ? Math.round(value) : value;
    };

    for (const field of COUNT_FIELDS) {
      const value = number(field, 1_000_000_000, true);
      if (value !== undefined) draft[field] = value;
    }
    for (const field of PERCENT_FIELDS) {
      const value = number(field, 100);
      if (value !== undefined) draft[field] = value;
    }
    const watch = number('avgWatchSeconds', 86_400);
    if (watch !== undefined) draft.avgWatchSeconds = watch;

    const retention: NonNullable<PostDraft['retention']> = {};
    for (const field of RETENTION_FIELDS) {
      const value = number(field, field === 'endHoldPct' ? 100 : 86_400);
      if (value !== undefined) retention[field] = value;
    }
    const sources: NonNullable<NonNullable<PostDraft['retention']>['sources']> = {};
    for (const field of SOURCE_FIELDS) {
      const value = number(field, 100);
      if (value !== undefined) sources[field] = value;
    }
    if (Object.keys(sources).length > 0) retention.sources = sources;
    if (Object.keys(retention).length > 0) draft.retention = retention;
    result.drafts.push({ line, draft });
  });
  return result;
}

// --- Merging with existing posts -------------------------------------------------

export interface MergeTarget {
  id: string;
  date: string;
  platform: Platform;
  topic?: string;
}

function sameTopic(a?: string, b?: string): boolean {
  return a !== undefined && b !== undefined && normalizeKey(a) === normalizeKey(b);
}

/** Only the known values of the draft (unknown values never overwrite known ones). */
export function knownValues(draft: PostDraft, base?: Partial<PostDraft>): Partial<PostDraft> {
  const patch: Partial<PostDraft> = {};
  for (const [key, value] of Object.entries(draft) as [keyof PostDraft, unknown][]) {
    if (value === undefined || key === 'retention') continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  if (draft.retention) {
    const retention = { ...base?.retention, ...draft.retention };
    if (draft.retention.sources)
      retention.sources = { ...base?.retention?.sources, ...draft.retention.sources };
    patch.retention = retention;
  }
  return patch;
}

export type MergePlan<T extends MergeTarget> =
  { kind: 'update'; target: T; draft: PostDraft } | { kind: 'create'; draft: PostDraft };

/**
 * Matches each draft to an existing post (same date + platform + topic; without topic only if
 * exactly one post of that platform exists on that day) or to an earlier new row; the rest is new.
 * A retention.csv row therefore lands in the post of performance.csv.
 */
export function planImport<T extends MergeTarget>(
  existing: readonly T[],
  drafts: readonly PostDraft[],
): MergePlan<T>[] {
  const plans: MergePlan<T>[] = [];
  const created: { kind: 'create'; draft: PostDraft }[] = [];
  for (const draft of drafts) {
    const sameDay = existing.filter(
      (post) => post.date === draft.date && post.platform === draft.platform,
    );
    const target =
      sameDay.find((post) => sameTopic(post.topic, draft.topic)) ??
      (!draft.topic && sameDay.length === 1 ? sameDay[0] : undefined);
    const plannedUpdate = target
      ? plans.find((plan) => plan.kind === 'update' && plan.target.id === target.id)
      : undefined;
    if (plannedUpdate?.kind === 'update') {
      plannedUpdate.draft = {
        ...plannedUpdate.draft,
        ...knownValues(draft, plannedUpdate.draft),
      };
      continue;
    }
    if (target) {
      plans.push({ kind: 'update', target, draft });
      continue;
    }
    const earlier = created.find(
      (plan) =>
        plan.draft.date === draft.date &&
        plan.draft.platform === draft.platform &&
        (sameTopic(plan.draft.topic, draft.topic) || !draft.topic),
    );
    if (earlier) {
      earlier.draft = { ...earlier.draft, ...knownValues(draft, earlier.draft) };
      continue;
    }
    const plan = { kind: 'create' as const, draft };
    created.push(plan);
    plans.push(plan);
  }
  return plans;
}
