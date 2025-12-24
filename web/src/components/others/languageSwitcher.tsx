import { cn } from '@/lib/utils';
import i18next from 'i18next';

function LanguageSwitcher({ className = '' }: { className?: string }) {
  const currentLang = i18next.language.slice(0, 2);

  return (
    <div className={cn('cursor-pointer space-x-0.5 font-mono text-sm duration-300', className)}>
      <span
        onClick={() => i18next.changeLanguage('zh')}
        className={`border-[0.5px] px-2 py-1 ${currentLang === 'zh' ? 'text-theme bg-theme/5' : 'text-primary border-transparent'}`}
      >
        中文
      </span>
      <span
        onClick={() => i18next.changeLanguage('en')}
        className={`border-[0.5px] px-2 py-1 ${currentLang === 'en' ? 'text-theme bg-theme/5' : 'text-primary border-transparent'}`}
      >
        EN
      </span>
      <span
        onClick={() => i18next.changeLanguage('ja')}
        className={`border-[0.5px] px-2 py-1 ${currentLang === 'ja' ? 'text-theme bg-theme/5' : 'text-primary border-transparent'}`}
      >
        日本語
      </span>
    </div>
  );
}

export default LanguageSwitcher;
