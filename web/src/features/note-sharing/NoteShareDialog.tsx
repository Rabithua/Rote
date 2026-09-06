import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
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
import { createNoteShare, getNoteShare, noteShareUrl, revokeNoteShare } from './api';
import type { NoteShareLink } from './types';

export function NoteShareDialog({
  noteId,
  isPublic,
  onClose,
}: {
  noteId: string;
  isPublic: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.noteShare' });
  const [share, setShare] = useState<NoteShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const linkInput = useRef<HTMLInputElement>(null);
  const url = share ? noteShareUrl(share.token) : '';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    getNoteShare(noteId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setShare(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [noteId, attempt]);

  async function copyShare() {
    setBusy(true);
    let current = share;
    if (!current) {
      try {
        current = await createNoteShare(noteId);
        setShare(current);
      } catch {
        toast.error(t('createFailed'));
        setBusy(false);
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(noteShareUrl(current.token));
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
      linkInput.current?.focus();
      linkInput.current?.select();
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true);
    try {
      await revokeNoteShare(noteId);
      setShare(null);
      toast.success(t('stopped'));
    } catch {
      toast.error(t('stopFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent closeLabel={t('close')} showCloseButton={!busy} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role="status" className="text-muted-foreground text-sm">
            {t('loading')}
          </p>
        ) : loadFailed ? (
          <div className="space-y-3">
            <p role="alert" className="text-destructive text-sm">
              {t('loadFailed')}
            </p>
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <>
            {share && (
              <div className="space-y-2">
                <Label htmlFor="note-share-link">{t('linkLabel')}</Label>
                <Input
                  ref={linkInput}
                  id="note-share-link"
                  value={url}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
            )}
            <p className="text-muted-foreground text-xs leading-relaxed">{t('attachmentNotice')}</p>
            {isPublic && (
              <p className="text-muted-foreground text-xs leading-relaxed">{t('publicNotice')}</p>
            )}
            <div className="flex gap-2">
              {share && (
                <Button variant="outline" className="flex-1" disabled={busy} onClick={stopSharing}>
                  {t('stop')}
                </Button>
              )}
              <Button className="flex-[2]" disabled={busy} onClick={copyShare}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Copy />}
                {share ? t('copy') : t('createAndCopy')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
