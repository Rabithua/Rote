import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';

import { cn } from '@/utils/cn';
import { RemoteImage } from '@/components/images/RemoteImage';

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  onLoadingStatusChange,
  onLoad,
  onError,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return props.src ? (
    <RemoteImage
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
      onLoad={(event) => {
        onLoadingStatusChange?.('loaded');
        onLoad?.(event);
      }}
      onError={(event) => {
        onLoadingStatusChange?.('error');
        onError?.(event);
      }}
    />
  ) : null;
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('bg-muted flex size-full items-center justify-center rounded-full', className)}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
