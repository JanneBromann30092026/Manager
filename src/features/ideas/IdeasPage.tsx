import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ClipboardPaste, Plus } from 'lucide-react';
import { Button, EmptyState, SearchInput, Select } from '@/components/ui';
import { Page } from '@/app/shell/Page';
import { filterIdeas, seriesOptions, sortIdeas, type IdeaFilter } from '@/core/ideas';
import { IDEA_SOURCES, IDEA_STATUSES, type IdeaSource } from '@/data/domain';
import type { Idea } from '@/data/schemas';
import { useDataStore } from '@/data/store';
import { IDEA_SOURCE_LABELS, IDEA_STATUS_LABELS, SERIES_SUGGESTIONS } from '@/data/templates';
import { de } from '@/i18n/de';
import { BulkDialog } from './BulkDialog';
import { IdeaCard } from './IdeaCard';
import { IdeaEditor } from './IdeaEditor';

const t = de.ideas;

const ALL = 'all';
type StatusFilter = NonNullable<IdeaFilter['status']> | typeof ALL;

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: t.allStatuses },
  ...IDEA_STATUSES.map((value) => ({ value, label: IDEA_STATUS_LABELS[value] })),
  { value: ALL, label: t.everything },
];
const sourceOptions: { value: IdeaSource | typeof ALL; label: string }[] = [
  { value: ALL, label: t.allSources },
  ...IDEA_SOURCES.map((value) => ({ value, label: IDEA_SOURCE_LABELS[value] })),
];

/** Idea store: capture, filter, prioritise, move along the status flow. */
export function IdeasPage() {
  const ideasMap = useDataStore((s) => s.ideas);
  const ideas = useMemo(() => Object.values(ideasMap), [ideasMap]);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [source, setSource] = useState<IdeaSource | typeof ALL>(ALL);
  const [series, setSeries] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ idea?: Idea } | null>(null);
  const [bulk, setBulk] = useState(false);

  const allSeries = useMemo(() => seriesOptions(ideas, SERIES_SUGGESTIONS), [ideas]);
  const usedSeries = useMemo(() => seriesOptions(ideas, []), [ideas]);
  const visible = useMemo(
    () =>
      sortIdeas(
        filterIdeas(ideas, {
          status: status === ALL ? undefined : status,
          source: source === ALL ? undefined : source,
          series: series === ALL ? undefined : series,
          query,
        }),
      ),
    [ideas, status, source, series, query],
  );
  const filtered = status !== 'open' || source !== ALL || series !== ALL || query !== '';

  const resetFilters = () => {
    setStatus('open');
    setSource(ALL);
    setSeries(ALL);
    setQuery('');
  };

  return (
    <Page
      title={t.title}
      actions={
        <>
          <Button variant="secondary" size="sm" icon={ClipboardPaste} onClick={() => setBulk(true)}>
            <span className="max-[30rem]:sr-only">{t.bulk}</span>
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setEditing({})} data-testid="idea-add">
            <span className="max-[30rem]:sr-only">{t.add}</span>
          </Button>
        </>
      }
    >
      {ideas.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          text={t.emptyText}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={Plus} onClick={() => setEditing({})}>
                {t.add}
              </Button>
              <Button variant="secondary" icon={ClipboardPaste} onClick={() => setBulk(true)}>
                {t.bulk}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 pb-8">
          <SearchInput
            label={t.search}
            clearLabel={t.searchClear}
            placeholder={t.search}
            value={query}
            onChange={setQuery}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="idea-filters">
            <Select
              label={t.status}
              options={statusOptions}
              value={status}
              onChange={setStatus}
              data-testid="filter-status"
            />
            <Select
              label={t.source}
              options={sourceOptions}
              value={source}
              onChange={setSource}
              data-testid="filter-source"
            />
            <Select
              label={t.series}
              options={[
                { value: ALL, label: t.allSeries },
                ...usedSeries.map((value) => ({ value, label: value })),
              ]}
              value={series}
              onChange={setSeries}
              data-testid="filter-series"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-sm font-medium text-fg-secondary" data-testid="idea-count">
              {t.count(visible.length)}
            </span>
            <span className="text-sm text-fg-muted">{t.sortHint}</span>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              title={t.noMatchTitle}
              text={t.noMatchText}
              action={
                filtered && (
                  <Button variant="secondary" onClick={resetFilters}>
                    {t.resetFilters}
                  </Button>
                )
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 wide:grid-cols-2" data-testid="idea-list">
              <AnimatePresence initial={false}>
                {visible.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onOpen={() => setEditing({ idea })} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}
      <IdeaEditor
        open={editing !== null}
        idea={editing?.idea}
        seriesSuggestions={allSeries}
        onClose={() => setEditing(null)}
      />
      <BulkDialog open={bulk} onClose={() => setBulk(false)} />
    </Page>
  );
}
