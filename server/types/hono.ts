import { Context } from 'hono';

// 安全用户类型（不包含敏感信息）
export type SafeUser = {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  description: string | null;
  avatar: string | null;
  cover: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

// Hono Context Variables 类型定义
export interface HonoVariables {
  user?: SafeUser;
  dynamicApiUrl?: string;
  dynamicFrontendUrl?: string;
  openKey?: {
    id: string;
    userid: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

// 扩展 Hono Context 类型
export type HonoContext = Context<{
  Variables: HonoVariables;
}>;
