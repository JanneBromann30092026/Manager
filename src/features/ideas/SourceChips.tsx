import { ChoiceChip } from '@/components/ui';
import { IDEA_SOURCES, type IdeaSource } from '@/data/domain';
import { IDEA_SOURCE_LABELS } from '@/data/templates';

/** Source picker as wrapping chips (fits the iPhone, unlike a segmented control). */
export function SourceChips({
  value,
  onChange,
}: {
  value: IdeaSource;
  onChange: (source: IdeaSource) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {IDEA_SOURCES.map((source) => (
        <ChoiceChip key={source} selected={value === source} onToggle={() => onChange(source)}>
          {IDEA_SOURCE_LABELS[source]}
        </ChoiceChip>
      ))}
    </div>
  );
}
