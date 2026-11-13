export interface UploadResult {
  url: string | null;
  compressUrl: string | null;
  posterUrl: string | null;
  details: {
    size: number;
    mimetype: string | null;
    mtime: Date | null | undefined;
    hash: string | null | undefined;
    // 对象存储中的 Key，便于删除和追踪
    mediaKind?: 'image' | 'video' | 'livePhoto' | null;
    key?: string;
    compressKey?: string;
    posterKey?: string;
    pairedVideoKey?: string;
    pairedVideoUrl?: string;
    pairedVideoMimetype?: string | null;
    pairedVideoSize?: number;
    pairedVideoFilename?: string;
  };
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  timestamp?: number;
  tag?: string;
  badge?: string;
  image?: string;
  vibrate?: number[];
  data?: any;
  silent?: boolean;
  requireInteraction?: boolean;
}

// 用户角色枚举（扁平双层：普通用户 + 超级管理员）
export enum UserRole {
  USER = 'user',
  SUPER_ADMIN = 'super_admin',
}

// 角色权限定义
export interface RolePermissions {
  canManageUsers: boolean;
  canManageSystem: boolean;
  canModerateContent: boolean;
  canAccessAdminPanel: boolean;
}

// 角色权限映射
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.USER]: {
    canManageUsers: false,
    canManageSystem: false,
    canModerateContent: false,
    canAccessAdminPanel: false,
  },
  [UserRole.SUPER_ADMIN]: {
    canManageUsers: true,
    canManageSystem: true,
    canModerateContent: true,
    canAccessAdminPanel: true,
  },
};
