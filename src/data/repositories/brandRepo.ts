/**
 * The brand record: exactly one per vault (channel profile, rules, brand kit, checklist).
 * Until the creator changes something, the defaults from src/data/templates apply.
 */
import { nextTimestamp } from '@/core/time';
import { parseOrThrow } from '../errors';
import { brandInputSchema, type Brand, type BrandInput } from '../schemas';
import { useDataStore } from '../store';
import { validateRecord } from './recordsRepo';
import { commit } from './rows';

/** Newest stored brand record (two tabs could have created one each). */
function stored(brands: Record<string, Brand>): Brand | undefined {
  return Object.values(brands).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

const DEFAULT_TIMESTAMP = '1970-01-01T00:00:00.000Z';

/** Brand built from the templates (not stored yet). */
export function defaultBrand(): Brand {
  return validateRecord('brand', {
    ...parseOrThrow(brandInputSchema, {}),
    id: '00000000-0000-4000-8000-000000000000',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  });
}

let fallback: Brand | undefined;

/** Selector for components: the stored brand or the template defaults. */
export function selectBrand(state: { brand: Record<string, Brand> }): Brand {
  const brand = stored(state.brand);
  if (brand) return brand;
  fallback ??= defaultBrand();
  return fallback;
}

export const brandRepo = {
  get(): Brand {
    return selectBrand(useDataStore.getState());
  },

  /** True once the creator saved anything (otherwise the defaults are shown). */
  isStored(): boolean {
    return stored(useDataStore.getState().brand) !== undefined;
  },

  /** Merges a patch into the brand (top-level fields) and stores it encrypted. */
  async update(patch: Partial<BrandInput>): Promise<Brand> {
    const current = stored(useDataStore.getState().brand);
    const now = nextTimestamp(current?.updatedAt);
    const fields = parseOrThrow(brandInputSchema, {
      ...(current ?? {}),
      ...patch,
    });
    const record = validateRecord('brand', {
      ...fields,
      id: current?.id ?? crypto.randomUUID(),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });
    await commit([{ table: 'brand', record }]);
    return record;
  },

  /** Back to the template defaults (files stay in the file store). */
  async reset(): Promise<void> {
    const ids = Object.keys(useDataStore.getState().brand);
    if (ids.length > 0) await commit([], [{ table: 'brand', ids }]);
  },
};
