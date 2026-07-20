import { useTranslation } from 'react-i18next';

import flomoLogo from '@/assets/import/flomo.svg';
import memosLogo from '@/assets/import/memos.svg';
import roteLogo from '@/assets/import/rote.svg';
import wereadLogo from '@/assets/import/weread.svg';
import { Button } from '@/components/ui/button';

import type { ImportSource } from './sourceLoader';

interface ImportPlatform {
  source: ImportSource;
  logo: string;
  nameKey: string;
}

interface ImportPlatformPickerProps {
  disabled?: boolean;
  onSelect: (source: ImportSource) => void;
}

export const IMPORT_PLATFORMS: ReadonlyArray<ImportPlatform> = [
  {
    source: 'rote',
    logo: roteLogo,
    nameKey: 'sources.rote',
  },
  {
    source: 'memos',
    logo: memosLogo,
    nameKey: 'sources.memos',
  },
  {
    source: 'flomo',
    logo: flomoLogo,
    nameKey: 'sources.flomo',
  },
  {
    source: 'weread',
    logo: wereadLogo,
    nameKey: 'sources.weread',
  },
];

export function getImportPlatform(source: ImportSource): ImportPlatform {
  const platform = IMPORT_PLATFORMS.find((item) => item.source === source);
  if (!platform) throw new Error(`Unsupported import platform: ${source}`);
  return platform;
}

export default function ImportPlatformPicker({
  disabled = false,
  onSelect,
}: ImportPlatformPickerProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData.migration',
  });

  return (
    <div className="grid w-full max-w-xl grid-cols-2 gap-0 sm:grid-cols-4">
      {IMPORT_PLATFORMS.map((platform) => {
        const platformName = t(platform.nameKey);

        return (
          <Button
            key={platform.source}
            type="button"
            variant="ghost"
            className="h-auto flex-col gap-2 rounded-none px-2 py-4 hover:bg-transparent hover:opacity-80"
            disabled={disabled}
            onClick={() => onSelect(platform.source)}
            aria-label={t('platformCardLabel', { platform: platformName })}
          >
            <img
              src={platform.logo}
              alt=""
              width={56}
              height={56}
              className="border-border/70 size-14 border"
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{platformName}</span>
          </Button>
        );
      })}
    </div>
  );
}
