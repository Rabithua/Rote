import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { post, put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import { Plus, Send, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AdminHookChannel, SystemConfig } from '../types';
import HookChannelDialog from './HookChannelDialog';
import { EVENT_TRANSLATION_KEYS, normalizeChannel, normalizeChannels } from './hookChannelConfig';

interface HooksConfigTabProps {
  isSaving: boolean;
  notificationConfig: SystemConfig['notification'] | undefined;
  onMutate: () => void;
  setIsSaving: (saving: boolean) => void;
  setNotificationConfig: (config: SystemConfig['notification'] | undefined) => void;
}

function summarizeDelivery(result: any) {
  const summary = result?.data?.data?.summary || result?.data?.summary || result?.summary;
  if (!summary) return '';
  return `${summary.success || 0}/${summary.success + summary.failed + summary.skipped || 0}`;
}

export default function HooksConfigTab({
  isSaving,
  notificationConfig,
  onMutate,
  setIsSaving,
  setNotificationConfig,
}: HooksConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);

  const hooks = notificationConfig?.adminHooks || { enabled: false, channels: [] };
  const editingChannel = editingChannelId
    ? hooks.channels.find((channel) => channel.id === editingChannelId)
    : undefined;

  const updateHooks = async (adminHooks: typeof hooks): Promise<boolean> => {
    if (isSaving) return false;

    const nextConfig = {
      ...(notificationConfig || {}),
      adminHooks: {
        ...adminHooks,
        channels: normalizeChannels(adminHooks.channels),
      },
    };
    setIsSaving(true);
    try {
      await put('/admin/settings', { config: nextConfig, group: 'notification' });
      setNotificationConfig(nextConfig);
      toast.success(t('saveSuccess'));
      onMutate();
      return true;
    } catch (error) {
      toast.error(t('saveFailed', { error: getErrorMessage(error) || t('hooks.unknownError') }));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const removeChannel = async (id: string) => {
    const saved = await updateHooks({
      ...hooks,
      channels: hooks.channels.filter((channel) => channel.id !== id),
    });
    if (saved && editingChannelId === id) {
      setDialogOpen(false);
      setEditingChannelId(null);
    }
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingChannelId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (id: string) => {
    setDialogMode('edit');
    setEditingChannelId(id);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingChannelId(null);
  };

  const handleDialogSubmit = (channel: AdminHookChannel) =>
    updateHooks({
      ...hooks,
      channels:
        dialogMode === 'edit'
          ? hooks.channels.map((current) => (current.id === channel.id ? channel : current))
          : [...hooks.channels, channel],
    });

  const handleTest = async (channel: AdminHookChannel) => {
    setTestingId(channel.id);
    try {
      const result = await post('/admin/hooks/test', {
        channel: normalizeChannel(channel),
      });
      toast.success(t('hooks.testSuccess', { result: summarizeDelivery(result) }));
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        t('hooks.unknownError');
      toast.error(t('hooks.testFailed', { error: errorMessage }));
    } finally {
      setTestingId(null);
    }
  };

  const getChannelDetail = (channel: AdminHookChannel) => {
    if (channel.type === 'bark') {
      return channel.serverUrl || 'https://api.day.app';
    }
    if (channel.type === 'http') {
      return channel.url || t('hooks.notConfigured');
    }
    return t('hooks.adminPwaDetail');
  };

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{t('hooks.title')}</CardTitle>
            <CardDescription>{t('hooks.description')}</CardDescription>
          </div>
          <Button type="button" onClick={openCreateDialog} disabled={isSaving} className="gap-2">
            <Plus className="size-4" />
            {t('hooks.add')}
          </Button>
        </div>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="space-y-0.5">
            <Label>{t('hooks.enabled')}</Label>
            <p className="text-muted-foreground text-sm">{t('hooks.enabledDesc')}</p>
          </div>
          <Switch
            aria-label={t('hooks.enabled')}
            checked={hooks.enabled}
            disabled={isSaving}
            onCheckedChange={(checked) => updateHooks({ ...hooks, enabled: checked })}
          />
        </div>

        <div className="space-y-3">
          {hooks.channels.length === 0 && (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
              {t('hooks.empty')}
            </div>
          )}

          {hooks.channels.map((channel) => {
            const normalizedChannel = normalizeChannel(channel);
            return (
              <div key={channel.id} className="space-y-4 rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{channel.name}</span>
                        <Badge variant="outline">{t(`hooks.channelTypes.${channel.type}`)}</Badge>
                        <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                          {channel.enabled ? t('hooks.enabledStatus') : t('hooks.disabledStatus')}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm break-all">
                        {getChannelDetail(channel)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(channel.id)}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Settings2 className="size-4" />
                      {t('hooks.configure')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(channel)}
                      disabled={isSaving || testingId === channel.id}
                      className="gap-2"
                    >
                      <Send className="size-4" />
                      {testingId === channel.id ? t('hooks.testing') : t('hooks.test')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeChannel(channel.id)}
                      disabled={isSaving}
                      className="text-destructive hover:text-destructive gap-2"
                    >
                      <Trash2 className="size-4" />
                      {t('hooks.remove')}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {normalizedChannel.events.length > 0 ? (
                    normalizedChannel.events.map((eventName) => (
                      <Badge key={eventName} variant="secondary">
                        {t(`hooks.eventsMap.${EVENT_TRANSLATION_KEYS[eventName]}`)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">{t('hooks.noEvents')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <HookChannelDialog
        channel={editingChannel}
        isSaving={isSaving}
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleDialogSubmit}
      />
    </Card>
  );
}
