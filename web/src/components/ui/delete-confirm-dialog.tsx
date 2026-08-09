import { Loader } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteConfirmDialogProps {
  cancelLabel: string;
  confirmLabel: string;
  deletingLabel: string;
  description: string;
  isDeleting: boolean;
  open: boolean;
  title: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmDialog({
  cancelLabel,
  confirmLabel,
  deletingLabel,
  description,
  isDeleting,
  open,
  title,
  onConfirm,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isDeleting || nextOpen) onOpenChange(nextOpen);
      }}
    >
      <DialogContent closeLabel={cancelLabel} showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
          >
            {isDeleting && <Loader className="size-4 animate-spin" />}
            {isDeleting ? deletingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
