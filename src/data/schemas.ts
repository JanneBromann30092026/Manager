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
  VIDEO_STATUSES,
} from './domain';

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

const postFields = {
  /** Publishing date. */
  date: isoDate,
  platform: z.enum(PLATFORMS),
  format: z.enum(FORMATS),
  topic: optionalText(LIMITS.title),
  hookType: z.enum(HOOK_TYPES).optional(),
  videoId: id.optional(),
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

// --- Weekly reports -------------------------------------------------------------

const reportFields = {
  week: isoWeek,
  good: optionalText(LIMITS.text),
  bad: optionalText(LIMITS.text),
  why: optionalText(LIMITS.text),
  /** Exactly the three measures for next week (fewer while drafting). */
  actions: z.array(requiredText(LIMITS.text)).max(LIMITS.actions).default([]),
  progress: optionalText(LIMITS.text),
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

// --- Settings -------------------------------------------------------------

export const settingKeySchema = requiredText(LIMITS.settingKey);
