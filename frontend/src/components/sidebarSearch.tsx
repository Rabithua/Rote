import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function SidebarSearch() {
  const { t } = useTranslation('translation', { keyPrefix: 'components.sidebarSearch' });
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate('/filter', {
      state: {
        initialKeyword: keyword.trim(),
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="bg-opacityLight dark:bg-opacityDark flex items-center gap-2">
      <Input
        placeholder={t('placeholder')}
        className="inputOrTextAreaInit focus:bg-opacityLight dark:focus:bg-opacityDark px-4"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Search
        className="hover:bg-opacityLight dark:hover:bg-opacityDark size-10 shrink-0 p-3"
        onClick={handleSearch}
      />
    </div>
  );
}
