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
  onSubmit: (channel: AdminHookChannel) => Promise<boolean>;
  open: boolean;
}

export default function HookChannelDialog({
  channel,
  isSaving,
  mode,
  onOpenChange,
  onSubmit,
  open,
}: HookChannelDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const [draft, setDraft] = useState<AdminHookChannel>(() =>
    createDefaultChannel('bark', t('hooks.channelDefaults.bark'))
  );

  useEffect(() => {
    if (!open) return;
    setDraft(
      channel
        ? normalizeChannel(channel)
        : createDefaultChannel('bark', t('hooks.channelDefaults.bark'))
    );
  }, [channel, open, t]);

  const handleTypeChange = (type: AdminHookChannel['type']) => {
    setDraft((current) => {
      const oldDefaultName = t(`hooks.channelDefaults.${current.type}`);
      const next = createDefaultChannel(type, t(`hooks.channelDefaults.${type}`));
      return {
        ...next,
        enabled: current.enabled,
        events: current.events,
        id: current.id,
        name: current.name === oldDefaultName ? next.name : current.name,
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (await onSubmit(normalizeChannel(draft))) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen);
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
          <fieldset className="space-y-5" disabled={isSaving}>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                {t('hooks.dialog.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? t('saving')
                  : mode === 'create'
                    ? t('hooks.dialog.addAction')
                    : t('hooks.dialog.applyAction')}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
