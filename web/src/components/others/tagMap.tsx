import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { loadTagsAtom, tagsAtom } from '@/state/tags';
import { useAtomValue, useSetAtom } from 'jotai';
import { CircleDashed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function TagMap() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.tagMap',
  });

  const tags = useAtomValue(tagsAtom);
  const loadTags = useSetAtom(loadTagsAtom);
  const isLoading = tags === null;
  useEffect(() => {
    if (tags === null) loadTags();
  }, [tags, loadTags]);

  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const hiddenCount = tags ? tags.filter((t) => t.count <= 1).length : 0;
  const visibleTags = tags ? (isCollapsed ? tags.filter((t) => t.count > 1) : tags) : [];

  return (
    <>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : tags && tags?.length > 0 ? (
        <div className="animate-show flex shrink-0 flex-wrap gap-2 p-4 opacity-0 duration-300">
          {visibleTags.map((item) => (
            <Link
              key={item.name}
              to={'/filter'}
              state={{
                tags: [item.name],
              }}
            >
              <div className="bg-foreground/5 grow rounded-md px-2 py-1 text-center text-xs duration-300 hover:scale-95">
                {item.name}{' '}
                {item.count > 0 && <span className="ml-1 opacity-50">{item.count}</span>}
              </div>
            </Link>
          ))}
          {hiddenCount > 0 && (
            <div
              className="bg-foreground/5 flex cursor-pointer items-center justify-center rounded-md px-2 py-1 text-center text-xs duration-300 hover:scale-95"
              onClick={toggleCollapse}
            >
              <span className="opacity-70">
                {isCollapsed
                  ? t('expandMore', { defaultValue: '展开' })
                  : t('collapse', { defaultValue: '收起' })}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-background shrink-0 py-4">
          <div className="text-info flex w-full flex-col items-center justify-center gap-4 py-4 text-sm font-light">
            <CircleDashed className="text-theme/30 size-8" />
            {t('noTags')}
          </div>
        </div>
      )}
    </>
  );
}
