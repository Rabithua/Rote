import { User } from '@prisma/client';
import { Context } from 'hono';

// Hono Context Variables 类型定义
export interface HonoVariables {
  user?: User;
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
