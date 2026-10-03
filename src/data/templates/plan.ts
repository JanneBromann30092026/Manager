/**
 * Weekly plan ("Wochenplan", docs/INHALTE.md): Reels, Stories and Q&A for next week within
 * 4 hours. Time per task is a template the creator can change in the app.
 */
import type { PlanItemKind, VideoStatus } from '../domain';

export const PLAN_KIND_LABELS: Record<PlanItemKind, string> = {
  reel: 'Reel',
  story: 'Story',
  qa: 'Q&A-Story',
  podcast: 'Podcast',
  other: 'Sonstiges',
};

/** Weekly time budget from the frame (ca. 4 hours per week). */
export const PLAN_BUDGET_MINUTES = 240;

/** Time per task in minutes (Reel = script 20 + shoot 30 + edit 40 + publish 10). */
export const PLAN_DEFAULT_MINUTES: Record<PlanItemKind, number> = {
  reel: 100,
  story: 10,
  qa: 20,
  podcast: 120,
  other: 30,
};

/** Frame: 1 Reel per week, goal 2. */
export const PLAN_REELS_TARGET = 2;

/** Share of the reel/podcast work still open, by video status. */
export const VIDEO_REMAINING_SHARE: Record<VideoStatus, number> = {
  idea: 1,
  script: 0.8,
  filmed: 0.4,
  edited: 0.1,
  published: 0,
};

/** What is left to do for a video in this status (start of the task title). */
export const VIDEO_NEXT_STEP: Record<VideoStatus, string> = {
  idea: 'Skript, Dreh & Schnitt',
  script: 'Drehen & schneiden',
  filmed: 'Schneiden & veröffentlichen',
  edited: 'Veröffentlichen',
  published: 'Veröffentlicht',
};

/** Weekdays (1 = Monday … 7 = Sunday) the suggestion uses. */
export const PLAN_SLOTS = {
  reels: [2, 4],
  qa: 3,
  stories: [
    { day: 1, title: 'Story: Teaser zum Reel der Woche' },
    { day: 5, title: 'Story: Antworten aus der Q&A' },
    { day: 6, title: 'Story: Blick hinter die Kulissen' },
  ],
} as const;

export const PLAN_TEXTS = {
  qaTitle: 'Q&A-Story: Fragen sammeln (Sticker)',
  ideaTask: (title: string) => `${VIDEO_NEXT_STEP.idea}: ${title}`,
  videoTask: (status: VideoStatus, topic: string) => `${VIDEO_NEXT_STEP[status]}: ${topic}`,
  calendarDescription: (kind: string, minutes: number) =>
    `${kind} · ca. ${minutes} Min. · aus dem Manager-Wochenplan`,
} as const;
