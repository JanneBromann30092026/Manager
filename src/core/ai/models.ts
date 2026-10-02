/** Selectable Claude models for the optional AI (the model ID is sent to the API as-is). */
export const AI_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (empfohlen)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (stärker, teurer)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (schnell, günstig)' },
] as const;

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

/** Model IDs: letters, digits, dots, dashes (e.g. claude-sonnet-5-5). */
export const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{2,99}$/;

export function isKnownModel(id: string): boolean {
  return AI_MODELS.some((model) => model.id === id);
}
