/**
 * Channel profile and frame from docs/INHALTE.md ("Kanal & Rolle", "Rahmen"). These are the
 * defaults of the brand record; the creator can edit them in "Marke".
 */

export const CHANNEL_DEFAULTS = {
  name: 'dein.Finanzbruder',
  platforms: 'Instagram + YouTube',
  topics: 'Finanzen, Versicherungen, persönliche Weiterentwicklung',
  positioning: 'Finanzwissen erklärt wie dem kleinen Bruder: verständlich, nahbar, ehrlich.',
  bioCore: 'Was ich lerne, hinterfrage & selbst umsetze.',
  tone: 'Seriös im Inhalt, locker in der Sprache.',
  style: 'Gesicht vor Kamera, KI-Memes mit eigenem Avatar, ruhige Musik.',
  frame: [
    'Creator: Student (Finanzwirtschaft & Versicherungsmanagement) und berufstätig, ca. 4 Std. pro Woche.',
    'Instagram: 1 Reel pro Woche (Ziel 2), 30–60 Sekunden.',
    'YouTube: Podcast, unregelmäßig; jede Folge wird zu 4–6 Clips als Reels/Shorts.',
    'Schnitt selbst in CapCut Pro (iPad).',
  ],
} as const;

/** Growth goal: organic, Instagram, 500 followers by 31.12.2026 (~30 per week). */
export const GOAL_DEFAULTS = {
  platform: 'instagram',
  followers: 500,
  deadline: '2026-12-31',
} as const;

/** Weekly time budget in minutes (4 hours). */
export const WEEKLY_BUDGET_MINUTES = 240;
