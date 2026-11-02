import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import UnsavedSettingsDialog from '../settings/UnsavedSettingsDialog';
import { useAdminSettingsDraft } from '../settings/useAdminSettingsDraft';
import type { AdminHookChannel } from '../types';
import HookChannelBarkFields from './HookChannelBarkFields';
import HookChannelHttpFields from './HookChannelHttpFields';
import { EVENT_TRANSLATION_KEYS, HOOK_EVENTS, normalizeChannel } from './hookChannelConfig';
import { createDefaultChannel, toggleEvent } from './hookChannelDialogUtils';

interface HookChannelDialogProps {
  channel?: AdminHookChannel;
  isSaving: boolean;
  mode: 'create' | 'edit';
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (channel: AdminHookChannel) => Promise<boolean>;
  open: boolean;
}

export default function HookChannelDialog(props: HookChannelDialogProps) {
  return props.open ? <HookChannelEditor {...props} /> : null;
}

function HookChannelEditor({
  channel,
  isSaving,
  mode,
  onOpenChange,
  onDirtyChange,
  onSubmit,
  open,
}: HookChannelDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const [defaultChannel] = useState<AdminHookChannel>(() =>
    createDefaultChannel('bark', t('hooks.channelDefaults.bark'))
  );
  const form = useAdminSettingsDraft(channel ? normalizeChannel(channel) : defaultChannel);
  const { value: draft, setValue: setDraft, isDirty } = form;
  const [closeRequested, setCloseRequested] = useState(false);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) setCloseRequested(true);
    else onOpenChange(false);
  };

  const handleTypeChange = (type: AdminHookChannel['type']) => {
    const oldDefaultName = t(`hooks.channelDefaults.${draft.type}`);
    const next = createDefaultChannel(type, t(`hooks.channelDefaults.${type}`));
    setDraft({
      ...next,
      enabled: draft.enabled,
      events: draft.events,
      id: draft.id,
      name: draft.name === oldDefaultName ? next.name : draft.name,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !isDirty) return;
    const submitted = normalizeChannel(draft);
    if (await onSubmit(submitted)) {
      form.markSaved(draft, submitted);
      onDirtyChange?.(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('hooks.dialog.addTitle') : t('hooks.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('hooks.dialog.addDesc') : t('hooks.dialog.editDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} aria-busy={isSaving}>
          <fieldset className="space-y-5 px-1" disabled={isSaving}>
            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div className="space-y-0.5">
                <Label>{t('hooks.channelEnabled')}</Label>
                <p className="text-muted-foreground text-sm">{t('hooks.channelEnabledDesc')}</p>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`hook-type-${draft.id}`}>{t('hooks.channelType')}</Label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => handleTypeChange(value as AdminHookChannel['type'])}
                  disabled={mode === 'edit'}
                >
                  <SelectTrigger id={`hook-type-${draft.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bark">{t('hooks.channelTypes.bark')}</SelectItem>
                    <SelectItem value="http">{t('hooks.channelTypes.http')}</SelectItem>
                    <SelectItem value="admin_pwa">{t('hooks.channelTypes.admin_pwa')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`hook-name-${draft.id}`}>{t('hooks.channelName')}</Label>
                <Input
                  id={`hook-name-${draft.id}`}
                  value={draft.name}
                  required
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
            </div>

            {draft.type === 'bark' && <HookChannelBarkFields channel={draft} onChange={setDraft} />}

            {draft.type === 'http' && <HookChannelHttpFields channel={draft} onChange={setDraft} />}

            <div className="space-y-2">
              <Label>{t('hooks.events')}</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {HOOK_EVENTS.map((eventName) => (
                  <label
                    key={eventName}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={draft.events.includes(eventName)}
                      onCheckedChange={(checked) =>
                        setDraft({
                          ...draft,
                          events: toggleEvent(draft.events, eventName, checked === true),
                        })
                      }
                    />
                    <span>{t(`hooks.eventsMap.${EVENT_TRANSLATION_KEYS[eventName]}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
          <DialogFooter className="bg-background mt-6 flex-row border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={requestClose}
              className="min-w-0 flex-1 whitespace-normal sm:flex-none"
            >
              {t('hooks.dialog.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !isDirty}
              className="min-w-0 flex-1 whitespace-normal sm:flex-none"
            >
              {isSaving
                ? t('saving')
                : mode === 'create'
                  ? t('hooks.dialog.addAction')
                  : t('hooks.dialog.applyAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <UnsavedSettingsDialog
        open={closeRequested}
        isSaving={isSaving}
        onContinue={() => setCloseRequested(false)}
        onDiscard={() => {
          if (isSaving) return;
          onDirtyChange?.(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
