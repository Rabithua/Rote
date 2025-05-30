import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { ArrowDownLeft, Tag } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LoadingPlaceholder from './LoadingPlaceholder';

export default function TagMap() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.tagMap',
  });

  const { data: tags, isLoading } = useAPIGet<string[]>('tags', () =>
    get('/users/me/tags').then((res) => res.data)
  );

  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : tags && tags?.length > 0 ? (
        <div
          className={`animate-show flex shrink-0 flex-wrap gap-2 p-4 opacity-0 duration-300 ${
            tags.length > 20 && isCollapsed ? 'max-h-80 overflow-hidden' : 'max-h-full'
          }`}
        >
          {tags.map((item: string) => {
            return (
              <Link
                key={item}
                to={'/filter'}
                state={{
                  tags: [item],
                }}
              >
                <div className="bg-opacityLight dark:bg-opacityDark flex-grow rounded-md px-2 py-1 text-center text-xs duration-300 hover:scale-95">
                  {item}
                </div>
              </Link>
            );
          })}
          {tags.length > 20 && isCollapsed && (
            <div
              onClick={toggleCollapse}
              className="from-bgLight via-bgLight/80 text-theme dark:from-bgDark dark:via-bgDark/80 absolute bottom-0 flex w-full cursor-pointer items-center justify-center gap-1 bg-gradient-to-t to-transparent pt-8 duration-300"
            >
              <ArrowDownLeft className="size-4" />
              {t('expand')}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-bgLight dark:bg-bgDark shrink-0 py-4">
          <div className="flex w-full flex-col items-center justify-center gap-4 py-4 text-sm">
            <Tag className="text-muted-foreground size-8" />
            {t('noTags')}
          </div>
        </div>
      )}
    </>
  );
}
