/**
 * Optional AI (Claude) straight from the browser. Off by default; the API key lives
 * encrypted in "secrets" and is decrypted only for the call. Every call uses the central
 * system prompt (src/core/ai/systemPrompt.ts).
 */
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/core/ai/systemPrompt';
import { brandRepo, secretsRepo } from '@/data/repositories';

export type AiErrorReason = 'noKey' | 'auth' | 'model' | 'rateLimit' | 'network' | 'unknown';

export class AiError extends Error {
  override readonly name = 'AiError';
  constructor(readonly reason: AiErrorReason) {
    super(reason);
  }
}

export function classifyAiError(error: unknown): AiErrorReason {
  if (error instanceof AiError) return error.reason;
  if (error instanceof Anthropic.AuthenticationError) return 'auth';
  if (error instanceof Anthropic.PermissionDeniedError) return 'auth';
  if (error instanceof Anthropic.NotFoundError) return 'model';
  if (error instanceof Anthropic.RateLimitError) return 'rateLimit';
  if (error instanceof Anthropic.APIConnectionError) return 'network';
  if (error instanceof Anthropic.BadRequestError) return 'model';
  return 'unknown';
}

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

async function requireKey(apiKey?: string): Promise<string> {
  const key = apiKey ?? (await secretsRepo.get('anthropicApiKey'));
  if (!key) throw new AiError('noKey');
  return key;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

/** Short test call; resolves with the model's answer or rejects with an AiError. */
export async function testConnection(model: string, apiKey?: string): Promise<string> {
  try {
    const message = await client(await requireKey(apiKey)).messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
    });
    return textOf(message);
  } catch (error: unknown) {
    throw new AiError(classifyAiError(error));
  }
}

/** One generation with the central system prompt (used from step 5 on). */
export async function generate(options: {
  model: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  try {
    const message = await client(await requireKey()).messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4_000,
      system: buildSystemPrompt(brandRepo.get()),
      messages: [{ role: 'user', content: options.prompt }],
    });
    return textOf(message);
  } catch (error: unknown) {
    throw new AiError(classifyAiError(error));
  }
}
