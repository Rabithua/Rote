import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PersonalAiMode, PersonalAiSettings } from '@/state/localAi';
import { BrainCog, Cloud, Loader, TestTube2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonalAiProbe, PersonalAiTestState } from '../hooks/usePersonalAiTesting';

const buttonType = `button` as const;
const passwordInputType = `password` as const;
const ghostButtonVariant = `ghost` as const;
const iconButtonSize = `icon` as const;

const dialogClasses = {
  content: `max-h-[85dvh] overflow-y-auto sm:max-w-2xl`,
  body: `space-y-4`,
  modeGrid: `grid gap-2 sm:grid-cols-2`,
  modeCard: `rounded-md border p-3 duration-200`,
  modeCardActive: `border-foreground bg-foreground text-background`,
  modeCardIdle: `hover:bg-muted/50`,
  modeHeader: `flex items-center gap-2 text-sm font-medium`,
  modeSelector: `flex min-w-0 flex-1 items-center gap-2 text-left`,
  icon: `size-4`,
  title: `min-w-0 truncate`,
  probe: `inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs`,
  probeReadyActive: `bg-background/20 text-background`,
  probeReadyIdle: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`,
  probeMissingActive: `bg-background/15 text-background/80`,
  probeMissingIdle: `bg-muted text-muted-foreground`,
  iconButton: `size-7 shrink-0`,
  spinIcon: `size-4 animate-spin`,
  detailButton: `mt-2 w-full text-left`,
  description: `line-clamp-3 text-xs opacity-80`,
  capability: `text-muted-foreground mt-1 text-xs`,
  settingsPanel: `rounded-md border p-4`,
  settingsHeader: `mb-4 flex items-center justify-between gap-3`,
  mutedText: `text-muted-foreground mt-1 text-xs`,
  fieldGrid: `grid gap-3`,
  field: `space-y-2`,
  note: `text-muted-foreground mt-3 text-xs`,
  guide: `bg-muted/20 rounded-md border p-3`,
  guideTitle: `text-sm font-medium`,
  guideCommand: `bg-background mt-2 block overflow-x-auto rounded-md border px-3 py-2 text-xs`,
  guideDesc: `text-muted-foreground mt-2 text-xs`,
};

function getModeCardClass(isActive: boolean) {
  return [
    dialogClasses.modeCard,
    isActive ? dialogClasses.modeCardActive : dialogClasses.modeCardIdle,
  ].join(' ');
}

function getProbeClass(ready: boolean, isActive: boolean) {
  const stateClass = ready
    ? isActive
      ? dialogClasses.probeReadyActive
      : dialogClasses.probeReadyIdle
    : isActive
      ? dialogClasses.probeMissingActive
      : dialogClasses.probeMissingIdle;
  return [dialogClasses.probe, stateClass].join(' ');
}

type PersonalAiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personalAi: PersonalAiSettings;
  personalAiTestState: PersonalAiTestState;
  isStatusLoading: boolean;
  getModeProbe: (mode: PersonalAiMode) => PersonalAiProbe;
  setPersonalAiSettings: (settings: PersonalAiSettings) => void;
  onTestMode: (mode: PersonalAiMode) => void;
};

export function PersonalAiDialog({
  open,
  onOpenChange,
  personalAi,
  personalAiTestState,
  isStatusLoading,
  getModeProbe,
  setPersonalAiSettings,
  onTestMode,
}: PersonalAiDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const setMode = (mode: PersonalAiMode) => {
    setPersonalAiSettings({ ...personalAi, mode });
  };
  const setProviderField = (patch: Partial<typeof personalAi.personal>) => {
    setPersonalAiSettings({
      ...personalAi,
      personal: { ...personalAi.personal, ...patch },
    });
  };
  const modeOptions: Array<{
    mode: PersonalAiMode;
    icon: ReactNode;
    title: string;
    description: string;
  }> = [
    {
      mode: 'site',
      icon: <Cloud className={dialogClasses.icon} />,
      title: t('personal.siteMode'),
      description: t('personal.siteModeDesc'),
    },
    {
      mode: 'personal',
      icon: <BrainCog className={dialogClasses.icon} />,
      title: t('personal.personalMode'),
      description: t('personal.personalModeDesc'),
    },
  ];
  const editableConfig = personalAi.personal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClasses.content}>
        <DialogHeader>
          <DialogTitle>{t('personal.title')}</DialogTitle>
          <DialogDescription>{t('personal.description')}</DialogDescription>
        </DialogHeader>
        <div className={dialogClasses.body}>
          <div className={dialogClasses.modeGrid}>
            {modeOptions.map((option) => {
              const isActive = personalAi.mode === option.mode;
              const probe = getModeProbe(option.mode);
              const testState = personalAiTestState[option.mode];

              return (
                <div key={option.mode} className={getModeCardClass(isActive)}>
                  <div className={dialogClasses.modeHeader}>
                    <button
                      type={buttonType}
                      className={dialogClasses.modeSelector}
                      onClick={() => setMode(option.mode)}
                    >
                      {option.icon}
                      <span className={dialogClasses.title}>{option.title}</span>
                    </button>
                    <span className={getProbeClass(probe.ready, isActive)}>{probe.label}</span>
                    <Button
                      type={buttonType}
                      variant={ghostButtonVariant}
                      size={iconButtonSize}
                      className={dialogClasses.iconButton}
                      disabled={testState.status === 'testing' || isStatusLoading}
                      onClick={() => onTestMode(option.mode)}
                      aria-label={t('personal.testButton')}
                      title={t('personal.testButton')}
                    >
                      {testState.status === 'testing' ? (
                        <Loader className={dialogClasses.spinIcon} />
                      ) : (
                        <TestTube2 className={dialogClasses.icon} />
                      )}
                    </Button>
                  </div>
                  <button
                    type={buttonType}
                    className={dialogClasses.detailButton}
                    onClick={() => setMode(option.mode)}
                  >
                    <p className={dialogClasses.description}>{option.description}</p>
                    <p className={dialogClasses.capability}>
                      {option.mode === 'site'
                        ? t('personal.siteCapability')
                        : t('personal.personalCapability')}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>

          {personalAi.mode !== 'site' && (
            <div className={dialogClasses.settingsPanel}>
              <div className={dialogClasses.settingsHeader}>
                <div>
                  <Label>{t('personal.enablePersonal')}</Label>
                  <p className={dialogClasses.mutedText}>{t('personal.enablePersonalDesc')}</p>
                </div>
                <Switch
                  checked={editableConfig.enabled}
                  onCheckedChange={(enabled) => setProviderField({ enabled })}
                />
              </div>

              <div className={dialogClasses.fieldGrid}>
                <div className={dialogClasses.field}>
                  <Label>{t('personal.baseUrl')}</Label>
                  <Input
                    value={editableConfig.baseUrl}
                    placeholder={t('personal.baseUrlPlaceholder')}
                    onChange={(event) => setProviderField({ baseUrl: event.target.value })}
                  />
                </div>
                <div className={dialogClasses.field}>
                  <Label>{t('personal.model')}</Label>
                  <Input
                    value={editableConfig.model}
                    placeholder={t('personal.modelPlaceholder')}
                    onChange={(event) => setProviderField({ model: event.target.value })}
                  />
                </div>
                <div className={dialogClasses.field}>
                  <Label>{t('personal.apiKey')}</Label>
                  <Input
                    type={passwordInputType}
                    value={editableConfig.apiKey}
                    onChange={(event) => setProviderField({ apiKey: event.target.value })}
                  />
                </div>
              </div>

              <p className={dialogClasses.note}>{t('personal.personalProxyNote')}</p>
            </div>
          )}

          {personalAi.mode === 'personal' ? (
            <div className={dialogClasses.guide}>
              <p className={dialogClasses.guideTitle}>{t('personal.startGuideTitle')}</p>
              <code className={dialogClasses.guideCommand}>{t('personal.startGuideCommand')}</code>
              <p className={dialogClasses.guideDesc}>{t('personal.startGuideDesc')}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
