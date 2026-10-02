import { useEffect, useState } from 'react';
import { FileText, PlugZap, Save, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Modal, Select, Toggle, toast } from '@/components/ui';
import { AI_MODELS, isKnownModel, MODEL_ID_PATTERN } from '@/core/ai/models';
import { buildSystemPrompt } from '@/core/ai/systemPrompt';
import { secretsRepo, selectBrand } from '@/data/repositories';
import { useDataStore } from '@/data/store';
import { de } from '@/i18n/de';
import { AiError, testConnection } from '@/services/ai/client';
import { useSettings } from './settingsStore';

const t = de.settings.ai;

const CUSTOM = 'custom';
const modelOptions = [
  ...AI_MODELS.map((model) => ({ value: model.id, label: model.label })),
  { value: CUSTOM, label: t.modelCustom },
];

/** Optional AI: on/off, API key (encrypted secret), model, connection test, system prompt. */
export function AiSettings() {
  const enabled = useSettings((s) => s.aiEnabled);
  const model = useSettings((s) => s.aiModel);
  const set = useSettings((s) => s.set);
  const brand = useDataStore(selectBrand);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [custom, setCustom] = useState(!isKnownModel(model));
  const [customModel, setCustomModel] = useState(isKnownModel(model) ? '' : model);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let active = true;
    void secretsRepo.has('anthropicApiKey').then((value) => {
      if (active) setHasKey(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const saveKey = async () => {
    if (!key.trim()) return;
    await secretsRepo.set('anthropicApiKey', key);
    setKey('');
    setHasKey(true);
    setResult(null);
    toast.success(t.keySaved);
  };

  const removeKey = async () => {
    await secretsRepo.remove('anthropicApiKey');
    setHasKey(false);
    setResult(null);
    toast.info(t.keyRemoved);
  };

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const answer = await testConnection(model);
      setResult({ ok: true, text: t.testOk(answer) });
    } catch (error: unknown) {
      const reason = error instanceof AiError ? error.reason : 'unknown';
      setResult({ ok: false, text: t.errors[reason] });
    } finally {
      setTesting(false);
    }
  };

  const customInvalid = custom && customModel !== '' && !MODEL_ID_PATTERN.test(customModel);

  return (
    <div className="flex flex-col gap-4" data-testid="ai-settings">
      <Toggle
        label={t.enabled}
        description={t.enabledHint}
        checked={enabled}
        onChange={(value) => void set('aiEnabled', value)}
      />
      {enabled && (
        <>
          <div className="h-px bg-line" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-base text-fg">{t.key}</span>
            {hasKey !== null && (
              <Badge tone={hasKey ? 'success' : 'neutral'}>
                <span data-testid="ai-key-state">{hasKey ? t.keyStored : t.keyMissing}</span>
              </Badge>
            )}
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveKey();
            }}
          >
            <Input
              label={t.key}
              hint={t.keyHint}
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={t.keyPlaceholder}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              data-testid="ai-key"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" icon={Save} disabled={!key.trim()}>
                {t.saveKey}
              </Button>
              {hasKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => void removeKey()}
                >
                  {t.removeKey}
                </Button>
              )}
            </div>
          </form>
          <div className="h-px bg-line" />
          <Select
            label={t.model}
            options={modelOptions}
            value={custom ? CUSTOM : model}
            onChange={(value) => {
              setResult(null);
              if (value === CUSTOM) {
                setCustom(true);
                return;
              }
              setCustom(false);
              void set('aiModel', value);
            }}
            data-testid="ai-model"
          />
          {custom && (
            <Input
              label={t.modelCustomLabel}
              hint={t.modelCustomHint}
              error={customInvalid ? t.modelInvalid : undefined}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              value={customModel}
              onChange={(event) => {
                const value = event.target.value.trim();
                setCustomModel(value);
                setResult(null);
                if (MODEL_ID_PATTERN.test(value)) void set('aiModel', value);
              }}
              data-testid="ai-model-custom"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={PlugZap}
              loading={testing}
              disabled={!hasKey || testing}
              onClick={() => void runTest()}
              data-testid="ai-test"
            >
              {t.test}
            </Button>
            <Button variant="ghost" size="sm" icon={FileText} onClick={() => setShowPrompt(true)}>
              {t.showPrompt}
            </Button>
          </div>
          {result && (
            <p
              role="status"
              data-testid="ai-test-result"
              className={result.ok ? 'text-sm text-success' : 'text-sm text-danger'}
            >
              {result.text}
            </p>
          )}
          <p className="text-sm text-fg-muted">{t.privacy}</p>
        </>
      )}
      <Modal open={showPrompt} onClose={() => setShowPrompt(false)} title={t.promptTitle}>
        <p className="mb-3 text-sm text-fg-muted">{t.promptText}</p>
        <pre
          className="max-h-[60dvh] overflow-auto rounded-xl bg-surface-sunken p-4 text-sm leading-6 whitespace-pre-wrap text-fg"
          data-testid="ai-system-prompt"
        >
          {buildSystemPrompt(brand)}
        </pre>
      </Modal>
    </div>
  );
}
