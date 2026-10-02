/**
 * Keys of the domain model (docs/INHALTE.md). Labels for the UI follow with the features
 * that show them.
 */

export const PLATFORMS = ['instagram', 'youtube'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Formats: Reel, Story, YouTube video, Short, podcast episode, podcast clip. */
export const FORMATS = ['reel', 'story', 'video', 'short', 'podcast', 'clip'] as const;
export type Format = (typeof FORMATS)[number];

/** Hook types of the script (question, number, contradiction) plus "other". */
export const HOOK_TYPES = ['question', 'number', 'contradiction', 'other'] as const;
export type HookType = (typeof HOOK_TYPES)[number];

/** CTA rotation: share → comment question → follow with a reason. */
export const CTA_TYPES = ['share', 'comment', 'follow'] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const VIDEO_KINDS = ['reel', 'podcast'] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

export const VIDEO_STATUSES = ['idea', 'script', 'filmed', 'edited', 'published'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const IDEA_SOURCES = ['own', 'community', 'podcast'] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export const IDEA_STATUSES = ['idea', 'planned', 'filmed', 'published'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** Where a number came from: typed in, read from a screenshot, CSV import or an API. */
export const VALUE_SOURCES = ['manual', 'screenshot', 'csv', 'youtubeApi', 'instagramApi'] as const;
export type ValueSource = (typeof VALUE_SOURCES)[number];

export const PLAN_ITEM_KINDS = ['reel', 'story', 'qa', 'podcast', 'other'] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

/** Kinds of stored files (brand photo, pose, font, screenshot, cover). */
export const FILE_KINDS = ['photo', 'pose', 'font', 'screenshot', 'cover'] as const;
export type FileKind = (typeof FILE_KINDS)[number];
