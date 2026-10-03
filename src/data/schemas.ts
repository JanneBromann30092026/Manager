/**
 * zod schemas of the decrypted records (docs/INHALTE.md). Everything here is only ever
 * stored encrypted (src/data/repositories/rows.ts).
 */
import { z } from 'zod';
import {
  CTA_TYPES,
  FILE_KINDS,
  FORMATS,
  HOOK_TYPES,
  IDEA_SOURCES,
  IDEA_STATUSES,
  PLAN_ITEM_KINDS,
  PLATFORMS,
  VALUE_SOURCES,
  VIDEO_KINDS,
  VIDEO_BLOCK_KEYS,
  VIDEO_STATUSES,
} from './domain';
import {
  BRAND_COLOR_DEFAULTS,
  CHANNEL_DEFAULTS,
  CONVERSION_KEYS,
  GROWTH_DEFAULTS,
  POSE_MOODS,
  RULES_DEFAULTS,
} from './templates';

export const LIMITS = {
  settingKey: 100,
  title: 160,
  series: 60,
  text: 5_000,
  /** Script, cut list, captions: long texts. */
  longText: 30_000,
  coverFiles: 12,
  actions: 3,
  planItems: 60,
  fileBytes: 15 * 1024 * 1024,
  fileName: 200,
  listItems: 20,
  poses: 12,
  /** Snapshots per post (Verlauf); older ones are thinned out. */
  postHistory: 60,
} as const;

// --- Building blocks --------------------------------------------------------

const id = z.uuid();
const timestamp = z.iso.datetime();

/** Calendar date "JJJJ-MM-TT" (local time, no time zone). */
export const isoDate = z.iso.date();

/** ISO week "JJJJ-Www" (e.g. 2026-W40), as in the report names. */
export const isoWeek = z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/);

/** Trimmed string; empty strings become undefined (field removed). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const count = z.int().min(0).max(1_000_000_000);
const percent = z.number().min(0).max(100);
const seconds = z
  .number()
  .min(0)
  .max(24 * 60 * 60);

const timestamps = { createdAt: timestamp, updatedAt: timestamp };

// --- Video packages ("Neues Video") -------------------------------------------

const videoFields = {
  /** Planned or actual publishing date. */
  date: isoDate,
  topic: requiredText(LIMITS.title),
  kind: z.enum(VIDEO_KINDS).default('reel'),
  status: z.enum(VIDEO_STATUSES).default('idea'),
  series: optionalText(LIMITS.series),
  hookType: z.enum(HOOK_TYPES).optional(),
  cta: z.enum(CTA_TYPES).optional(),
  ideaId: id.optional(),
  /** The six building blocks; empty until written or generated. */
  blocks: z
    .object({
      script: optionalText(LIMITS.longText),
      cutList: optionalText(LIMITS.longText),
      cover: optionalText(LIMITS.text),
      caption: optionalText(LIMITS.longText),
      youtube: optionalText(LIMITS.longText),
      communityQuestion: optionalText(LIMITS.text),
      clips: optionalText(LIMITS.longText),
    })
    .prefault({}),
  coverFileIds: z.array(id).max(LIMITS.coverFiles).default([]),
  /** Cover pose chosen in the cover studio; empty = automatic from text and hook (step 6). */
  coverPose: z.enum(POSE_MOODS).optional(),
  /** Blocks whose current text was written by Claude (shown as "(Claude)" drafts). */
  aiBlocks: z.array(z.enum(VIDEO_BLOCK_KEYS)).max(VIDEO_BLOCK_KEYS.length).default([]),
  /** Status changes, oldest first. */
  statusHistory: z
    .array(z.object({ status: z.enum(VIDEO_STATUSES), at: timestamp }))
    .max(50)
    .default([]),
  notes: optionalText(LIMITS.text),
  /** Invented demo/test record (removable in one go). */
  demo: z.boolean().default(false),
};
export const videoInputSchema = z.object(videoFields);
export type VideoInput = z.input<typeof videoInputSchema>;
export const videoSchema = z.object({ id, ...videoFields, ...timestamps });
export type Video = z.output<typeof videoSchema>;

// --- Ideas & community questions ---------------------------------------------

const ideaFields = {
  title: requiredText(LIMITS.title),
  source: z.enum(IDEA_SOURCES).default('own'),
  series: optionalText(LIMITS.series),
  hookType: z.enum(HOOK_TYPES).optional(),
  /** Personal "so mache ich es" topic (growth priority 2: ranks above lexicon topics). */
  personal: z.boolean().default(false),
  notes: optionalText(LIMITS.text),
  status: z.enum(IDEA_STATUSES).default('idea'),
  videoId: id.optional(),
  demo: z.boolean().default(false),
};
export const ideaInputSchema = z.object(ideaFields);
export type IdeaInput = z.input<typeof ideaInputSchema>;
export const ideaSchema = z.object({ id, ...ideaFields, ...timestamps });
export type Idea = z.output<typeof ideaSchema>;

// --- Posts with their numbers ("Auswertung") ---------------------------------

/** Share of views by source in percent (Instagram insights). */
const trafficSources = z.object({
  stories: percent.optional(),
  reelsTab: percent.optional(),
  feed: percent.optional(),
  profile: percent.optional(),
  explore: percent.optional(),
});

/** Values of a post at one API fetch (Verlauf). */
export const postSnapshotSchema = z.object({
  at: timestamp,
  views: count.optional(),
  reach: count.optional(),
  likes: count.optional(),
  comments: count.optional(),
  shares: count.optional(),
  saves: count.optional(),
  avgWatchSeconds: seconds.optional(),
});

const postFields = {
  /** Publishing date. */
  date: isoDate,
  platform: z.enum(PLATFORMS),
  format: z.enum(FORMATS),
  topic: optionalText(LIMITS.title),
  hookType: z.enum(HOOK_TYPES).optional(),
  videoId: id.optional(),
  /** Id on the platform (YouTube video id), set by the API import (step 9). */
  externalId: optionalText(100),
  /** When the numbers were read ("Stand"); early numbers (< 24 h) are marked as too early. */
  measuredAt: timestamp,
  source: z.enum(VALUE_SOURCES).default('manual'),
  // Unknown values stay empty – never estimated.
  views: count.optional(),
  nonFollowerPct: percent.optional(),
  avgWatchSeconds: seconds.optional(),
  likes: count.optional(),
  comments: count.optional(),
  shares: count.optional(),
  saves: count.optional(),
  newFollowers: count.optional(),
  /** Accounts reached (Instagram API). */
  reach: count.optional(),
  /** Exact publishing time (API import) – for weekday/time-of-day analysis. */
  publishedAt: timestamp.optional(),
  /** Caption length and hashtag count (API import) – the caption itself is not stored. */
  captionLength: count.optional(),
  hashtagCount: count.optional(),
  /** Values at each API fetch (growth over time), oldest first. */
  history: z.array(postSnapshotSchema).max(LIMITS.postHistory).default([]),
  retention: z
    .object({
      lengthSeconds: seconds.optional(),
      /** Seconds until half of the viewers are gone. */
      halfGoneSeconds: seconds.optional(),
      /** Share still watching at the end. */
      endHoldPct: percent.optional(),
      sources: trafficSources.optional(),
    })
    .optional(),
  notes: optionalText(LIMITS.text),
  demo: z.boolean().default(false),
};
export const postInputSchema = z.object(postFields);
export type PostInput = z.input<typeof postInputSchema>;
export const postSchema = z.object({ id, ...postFields, ...timestamps });
export type Post = z.output<typeof postSchema>;

// --- Account snapshots (follower count per day, from insights or the API) ------------

const accountStatFields = {
  date: isoDate,
  platform: z.enum(PLATFORMS).default('instagram'),
  followers: count,
  /** Optional insight values of the period ending on `date`. */
  views30d: count.optional(),
  newFollowers30d: count.optional(),
  views7d: count.optional(),
  nonFollowerPct7d: percent.optional(),
  source: z.enum(VALUE_SOURCES).default('manual'),
  notes: optionalText(LIMITS.text),
  demo: z.boolean().default(false),
};
export const accountStatInputSchema = z.object(accountStatFields);
export type AccountStatInput = z.input<typeof accountStatInputSchema>;
export const accountStatSchema = z.object({ id, ...accountStatFields, ...timestamps });
export type AccountStat = z.output<typeof accountStatSchema>;

// --- Weekly reports -------------------------------------------------------------

const reportFields = {
  week: isoWeek,
  good: optionalText(LIMITS.text),
  bad: optionalText(LIMITS.text),
  why: optionalText(LIMITS.text),
  /** Exactly the three measures for next week (fewer while drafting). */
  actions: z.array(requiredText(LIMITS.text)).max(LIMITS.actions).default([]),
  progress: optionalText(LIMITS.text),
  /** Texts were rewritten by Claude (draft, shown as „(Claude)“). */
  fromAi: z.boolean().default(false),
  demo: z.boolean().default(false),
};
export const reportInputSchema = z.object(reportFields);
export type ReportInput = z.input<typeof reportInputSchema>;
export const reportSchema = z.object({ id, ...reportFields, ...timestamps });
export type Report = z.output<typeof reportSchema>;

// --- Weekly plans ----------------------------------------------------------------

const planItemSchema = z.object({
  id,
  date: isoDate,
  kind: z.enum(PLAN_ITEM_KINDS),
  title: requiredText(LIMITS.title),
  minutes: z
    .int()
    .min(0)
    .max(24 * 60),
  ideaId: id.optional(),
  videoId: id.optional(),
  done: z.boolean().default(false),
});
export type PlanItem = z.output<typeof planItemSchema>;

const planFields = {
  week: isoWeek,
  /** Time budget of the week (default 4 hours). */
  budgetMinutes: z
    .int()
    .min(0)
    .max(7 * 24 * 60)
    .default(240),
  items: z.array(planItemSchema).max(LIMITS.planItems).default([]),
  demo: z.boolean().default(false),
};
export const planInputSchema = z.object(planFields);
export type PlanInput = z.input<typeof planInputSchema>;
export const planSchema = z.object({ id, ...planFields, ...timestamps });
export type Plan = z.output<typeof planSchema>;

// --- Files (brand photos, fonts, screenshots, covers) -----------------------------

/** Header stored encrypted together with the file bytes. */
export const fileMetaSchema = z.object({
  kind: z.enum(FILE_KINDS),
  name: requiredText(LIMITS.fileName),
  mime: requiredText(100),
  size: z.int().min(0).max(LIMITS.fileBytes),
  createdAt: timestamp,
});
export type FileMeta = z.output<typeof fileMetaSchema>;

// --- Brand (one record: channel profile, rules, brand kit, checklist) ------------

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toUpperCase());

/** List of short texts (rules, priorities, frame); empty lines are dropped. */
const textList = (defaults: readonly string[]) =>
  z
    .array(z.string().trim().max(LIMITS.text))
    .max(LIMITS.listItems)
    .transform((items) => items.filter(Boolean))
    .default([...defaults]);

const channelSchema = z.object({
  name: requiredText(LIMITS.title).default(CHANNEL_DEFAULTS.name),
  platforms: z.string().trim().max(LIMITS.title).default(CHANNEL_DEFAULTS.platforms),
  topics: z.string().trim().max(LIMITS.text).default(CHANNEL_DEFAULTS.topics),
  positioning: z.string().trim().max(LIMITS.text).default(CHANNEL_DEFAULTS.positioning),
  bioCore: z.string().trim().max(LIMITS.title).default(CHANNEL_DEFAULTS.bioCore),
  tone: z.string().trim().max(LIMITS.text).default(CHANNEL_DEFAULTS.tone),
  style: z.string().trim().max(LIMITS.text).default(CHANNEL_DEFAULTS.style),
  frame: textList(CHANNEL_DEFAULTS.frame),
});
export type Channel = z.output<typeof channelSchema>;

const poseSchema = z.object({ fileId: id, mood: z.enum(POSE_MOODS) });
export type Pose = z.output<typeof poseSchema>;

const brandFields = {
  channel: channelSchema.prefault({}),
  rules: textList(RULES_DEFAULTS),
  growth: textList(GROWTH_DEFAULTS),
  colors: z
    .object({
      deep: hexColor.default(BRAND_COLOR_DEFAULTS.deep),
      main: hexColor.default(BRAND_COLOR_DEFAULTS.main),
      light: hexColor.default(BRAND_COLOR_DEFAULTS.light),
      accent: hexColor.default(BRAND_COLOR_DEFAULTS.accent),
      text: hexColor.default(BRAND_COLOR_DEFAULTS.text),
    })
    .prefault({}),
  /** Cover font (file kind "font"); family name for FontFace. */
  fontFileId: id.optional(),
  /** Cut-out photo (file kind "photo") and poses (file kind "pose"). */
  photoFileId: id.optional(),
  poses: z.array(poseSchema).max(LIMITS.poses).default([]),
  /** Conversion checklist: done items. */
  checklist: z.partialRecord(z.enum(CONVERSION_KEYS), z.boolean()).default({}),
  /** Last used CTA of the rotation (step 5). */
  lastCta: z.enum(CTA_TYPES).optional(),
  demo: z.boolean().default(false),
};
export const brandInputSchema = z.object(brandFields);
export type BrandInput = z.input<typeof brandInputSchema>;
export const brandSchema = z.object({ id, ...brandFields, ...timestamps });
export type Brand = z.output<typeof brandSchema>;

// --- Settings -------------------------------------------------------------

export const settingKeySchema = requiredText(LIMITS.settingKey);
