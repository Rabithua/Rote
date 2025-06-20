import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useTranslation } from 'node_modules/react-i18next';

export default function SearchBar({
  defaultValue = '',
  onChange,
  onSearch,
}: {
  defaultValue?: string;
  onChange?: (_keyword: string) => void;
  onSearch: (_keyword: string) => void;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.sidebarSearch' });

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        onSearch((formData.get('keyword') as string) || '');
      }}
    >
      <Input
        name="keyword" // 添加 name 属性
        placeholder={t('placeholder')}
        className="inputOrTextAreaInit focus:bg-foreground/3 rounded-none px-4 text-sm!"
        defaultValue={defaultValue}
        onChange={(e) => {
          onChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSearch(e.currentTarget.value);
          }
        }}
      />
      <button
        type="submit"
        className="hover:bg-foreground/3 flex size-10 shrink-0 items-center justify-center p-3 duration-300"
        aria-label={t('search')}
      >
        <Search />
      </button>
    </form>
  );
}
