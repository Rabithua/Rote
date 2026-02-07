import type { Rote } from '@/types/main';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import RoteItem from './roteItem';

interface CollapsedRoteGroupProps {
  rotes: Rote[];
  mutate: SWRInfiniteKeyedMutator<Rote[]>;
}

export default function CollapsedRoteGroup({ rotes, mutate }: CollapsedRoteGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation('translation', { keyPrefix: 'components.roteList' });

  // The first rote is always shown
  const firstRote = rotes[0];
  const remainingRotes = rotes.slice(1);

  if (!firstRote) {
    return null;
  }

  return (
    <div className="flex flex-col divide-y">
      <RoteItem rote={firstRote} mutate={mutate} />

      <div
        style={{ top: 'var(--nav-height, 60px)' }}
        className={`flex cursor-pointer items-center justify-between gap-2 px-5 py-2 text-xs font-light transition-colors ${isExpanded ? 'bg-background sticky z-10' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>
          {isExpanded
            ? t('collapse', { defaultValue: 'Collapse' })
            : t('collapsedCount', {
                count: remainingRotes.length,
                name: firstRote.author.nickname || firstRote.author.username,
                defaultValue: `Show ${remainingRotes.length} more notes from ${firstRote.author.nickname || firstRote.author.username}`,
              })}
        </span>
        <ChevronRight className={`${isExpanded ? 'rotate-90' : ''} size-3 duration-300`} />
      </div>

      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 flex flex-col divide-y duration-300">
          {remainingRotes.map((rote) => (
            <RoteItem rote={rote} key={rote.id} mutate={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}
