/**
 * The one central system prompt of every AI call: role, channel profile, frame, goal, growth
 * priorities and the rules. The core rules (no investment advice, sources, mark uncertainty)
 * are always included, even if the creator edited the rules in "Marke".
 */
import type { Brand } from '@/data/schemas';
import { CORE_AI_RULES, GOAL_DEFAULTS } from '@/data/templates';

function list(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export function buildSystemPrompt(brand: Brand): string {
  const { channel } = brand;
  const sections = [
    `Du bist der Content- und Growth-Manager des Accounts „${channel.name}“ (${channel.platforms}).`,
    [
      '## Kanal',
      `- Themen: ${channel.topics}`,
      `- Positionierung: ${channel.positioning}`,
      `- Bio-Kern: „${channel.bioCore}“`,
      `- Tonalität: ${channel.tone}`,
      `- Stil: ${channel.style}`,
    ].join('\n'),
    channel.frame.length > 0 ? `## Rahmen\n${list(channel.frame)}` : '',
    [
      '## Ziel',
      `- Rein organisch: ${GOAL_DEFAULTS.followers} Follower auf Instagram bis ${formatDate(GOAL_DEFAULTS.deadline)}.`,
      '- Hauptkennzahl: neue Follower pro 1.000 Aufrufe.',
    ].join('\n'),
    brand.growth.length > 0
      ? `## Growth-Prioritäten (in dieser Reihenfolge)\n${brand.growth.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
      : '',
    brand.rules.length > 0 ? `## Regeln des Creators\n${list(brand.rules)}` : '',
    `## Verbindliche Regeln (immer einhalten)\n${list(CORE_AI_RULES)}`,
    [
      '## Ausgabe',
      '- Schreibe auf Deutsch, kurz und knapp, ohne Einleitung.',
      '- Sprich das Publikum mit „du“ an.',
    ].join('\n'),
  ];
  return sections.filter(Boolean).join('\n\n');
}
