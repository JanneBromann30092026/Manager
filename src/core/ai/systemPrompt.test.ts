import { describe, expect, it } from 'vitest';
import { defaultBrand } from '@/data/repositories/brandRepo';
import { CORE_AI_RULES } from '@/data/templates';
import { buildSystemPrompt } from './systemPrompt';
import { isKnownModel, MODEL_ID_PATTERN } from './models';

describe('buildSystemPrompt', () => {
  it('contains role, channel profile, goal, priorities and rules', () => {
    const prompt = buildSystemPrompt(defaultBrand());
    expect(prompt).toContain('Content- und Growth-Manager des Accounts „dein.Finanzbruder“');
    expect(prompt).toContain('Was ich lerne, hinterfrage & selbst umsetze.');
    expect(prompt).toContain('Seriös im Inhalt, locker in der Sprache.');
    expect(prompt).toContain('500 Follower auf Instagram bis 31.12.2026');
    expect(prompt).toContain('neue Follower pro 1.000 Aufrufe');
    expect(prompt).toContain('1. Conversion');
    expect(prompt).toContain('CapCut Pro');
  });

  it('always keeps the core rules, even when the editable rules are empty', () => {
    const brand = { ...defaultBrand(), rules: [], growth: [] };
    const prompt = buildSystemPrompt(brand);
    for (const rule of CORE_AI_RULES) expect(prompt).toContain(rule);
    expect(prompt).toContain('Keine Anlageberatung');
    expect(prompt).toContain('[Quelle prüfen]');
    expect(prompt).toContain('[unsicher]');
    expect(prompt).not.toContain('## Regeln des Creators');
    expect(prompt).not.toContain('## Growth-Prioritäten');
  });

  it('uses the edited channel profile', () => {
    const base = defaultBrand();
    const prompt = buildSystemPrompt({
      ...base,
      channel: { ...base.channel, name: 'test.kanal', tone: 'Sehr locker.' },
      rules: ['Immer mit Beispiel.'],
    });
    expect(prompt).toContain('„test.kanal“');
    expect(prompt).toContain('Sehr locker.');
    expect(prompt).toContain('- Immer mit Beispiel.');
  });
});

describe('models', () => {
  it('validates model IDs', () => {
    expect(isKnownModel('claude-sonnet-5-5')).toBe(true);
    expect(isKnownModel('claude-x')).toBe(false);
    expect(MODEL_ID_PATTERN.test('claude-haiku-4-5-20251001')).toBe(true);
    expect(MODEL_ID_PATTERN.test('Claude Sonnet')).toBe(false);
  });
});
