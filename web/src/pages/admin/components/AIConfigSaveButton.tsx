import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { post } from '@/utils/api';
import type { SystemConfig } from '../types';
import { formatEmbeddingError } from './embeddingErrors';

type AiConfiguration = NonNullable<SystemConfig['ai']>;

export default function AIConfigSaveButton({
  config,
  disabled,
  onSave,
}: {
  config: AiConfiguration;
  disabled: boolean;
  onSave: (config: AiConfiguration) => Promise<boolean>;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ config: AiConfiguration; signature: string } | null>(
    null
  );
  const button = useRef<HTMLButtonElement>(null);
  const signature = JSON.stringify(config);
  const currentSignature = useRef(signature);
  useEffect(() => {
    currentSignature.current = signature;
  }, [signature]);
  const save = async () => {
    if (!pending || pending.signature !== signature) return;
    setBusy(true);
    try {
      if (await onSave(pending.config)) setPending(null);
    } finally {
      setBusy(false);
    }
  };
  const checkImpact = async () => {
    const snapshot = structuredClone(config);
    setBusy(true);
    try {
      const result = await post('/ai/config/impact', { config: snapshot });
      if (currentSignature.current !== signature) return;
      if (result.data.requiresConfirmation) setPending({ config: snapshot, signature });
      else await onSave(snapshot);
    } catch (error) {
      toast.error(formatEmbeddingError(error, t) || t('ai.saveImpactCheckFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={pending !== null && pending.signature === signature}
      onOpenChange={(open) => {
        if (!open && !busy) setPending(null);
      }}
    >
      <Button ref={button} onClick={checkImpact} disabled={disabled || busy} className="w-full">
        {busy ? t('saving') : t('save')}
      </Button>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          button.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('ai.saveChangeTitle')}</DialogTitle>
          <DialogDescription className="text-pretty">
            {t('ai.saveChangeDescription')}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{t('ai.saveChangeReuse')}</p>
        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            {t('ai.saveChangeCancel')}
          </Button>
          <Button className="flex-[2]" disabled={disabled || busy} onClick={save}>
            {busy ? t('saving') : t('ai.saveChangeConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
