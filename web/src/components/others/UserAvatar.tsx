import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ComponentProps } from 'react';

interface UserAvatarProps extends ComponentProps<typeof Avatar> {
  avatar?: string | null;
  fallbackClassName?: string;
}

/**
 * 统一的用户头像组件
 * 自动处理默认头像显示逻辑
 */
function UserAvatar({ avatar, fallbackClassName, className, ...props }: UserAvatarProps) {
  return (
    <Avatar className={className} {...props}>
      {avatar ? (
        <AvatarImage src={avatar} />
      ) : (
        <AvatarFallback className={fallbackClassName}>
          <img src="/DefaultAvatar.svg" alt="" className="size-full object-cover" />
        </AvatarFallback>
      )}
    </Avatar>
  );
}

export default UserAvatar;
