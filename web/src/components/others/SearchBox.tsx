import { Input } from '@/components/ui/input';
import { Loader, Search } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';

export default function SearchBar({
  defaultValue = '',
  onChange,
  onSearch,
  isLoading = false,
  className,
}: {
  defaultValue?: string;
  onChange?: (_keyword: string) => void;
  onSearch: (_keyword: string) => void;
  isLoading?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.sidebarSearch' });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (value: string) => {
    // 总是触发搜索，即使输入框为空（允许清空搜索条件）
    const trimmedValue = value.trim();
    onSearch(trimmedValue);
  };

  return (
    <form
      className={`flex items-center gap-2 ${className || ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        // 如果正在加载，阻止提交
        if (isLoading) {
          return;
        }
        // 优先从 ref 获取值，如果没有则从 DOM 获取
        const inputValue =
          inputRef.current?.value ||
          (e.currentTarget.querySelector('input[name="keyword"]') as HTMLInputElement)?.value ||
          '';
        handleSearch(inputValue);
      }}
    >
      <Input
        ref={inputRef}
        name="keyword"
        placeholder={t('placeholder')}
        className="inputOrTextAreaInit focus:bg-foreground/3 rounded-none px-4 text-sm!"
        defaultValue={defaultValue}
        onChange={(e) => {
          onChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            // 如果正在加载，阻止搜索
            if (isLoading) {
              return;
            }
            handleSearch(e.currentTarget.value);
          }
        }}
      />
      <Button
        type="submit"
        className="rounded-none"
        aria-label={t('search')}
        disabled={isLoading}
        variant={'ghost'}
      >
        {isLoading ? <Loader className="size-4 animate-spin duration-300" /> : <Search />}
      </Button>
    </form>
  );
}
