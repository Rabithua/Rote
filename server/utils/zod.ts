import { z } from 'zod';
import mainJson from '../json/main.json';
const { safeRoutes } = mainJson;

export const RegisterDataZod = z.object({
  username: z
    .string()
    .min(1, 'Username cannot be empty')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and hyphen')
    .refine((value) => !safeRoutes.includes(value), {
      message: 'Username conflicts with routes, please choose another one',
    }),
  password: z
    .string()
    .min(6, '密码长度至少为 6 个字符')
    .max(128, '密码长度不能超过 128 个字符'),
  email: z
    .string()
    .min(1, 'Email cannot be empty')
    .max(30, 'Email cannot exceed 30 characters')
    .email('Invalid email format'),
  nickname: z
    .string()
    .min(1, 'Nickname cannot be empty')
    .max(20, 'Nickname cannot exceed 20 characters'),
});

export const passwordChangeZod = z.object({
  newpassword: z
    .string()
    .min(6, '密码长度至少为 6 个字符')
    .max(128, '密码长度不能超过 128 个字符'),
  oldpassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(128, 'Password cannot exceed 128 characters'),
});

// 笔记相关验证
export const NoteCreateZod = z.object({
  title: z.string().max(200, '标题不能超过 200 个字符').optional(),
  content: z.string().min(1, '内容不能为空').max(1000000, '内容不能超过 1,000,000 个字符'), // 约 1MB 文本
  type: z.string().optional(),
  tags: z
    .array(z.string().min(1, '标签不能为空').max(50, '单个标签不能超过 50 个字符'))
    .max(20, '最多只能添加 20 个标签')
    .optional(),
  state: z.string().optional(),
  archived: z.boolean().optional(),
  pin: z.boolean().optional(),
  editor: z.string().optional(),
  attachmentIds: z.array(z.string().uuid('无效的附件 ID')).optional(),
});

export const NoteUpdateZod = z.object({
  title: z.string().max(200, '标题不能超过 200 个字符').optional(),
  content: z.string().max(1000000, '内容不能超过 1,000,000 个字符').optional(),
  type: z.string().optional(),
  tags: z
    .array(z.string().min(1, '标签不能为空').max(50, '单个标签不能超过 50 个字符'))
    .max(20, '最多只能添加 20 个标签')
    .optional(),
  state: z.string().optional(),
  archived: z.boolean().optional(),
  pin: z.boolean().optional(),
  editor: z.string().optional(),
  attachmentIds: z.array(z.string().uuid('无效的附件 ID')).optional(),
});

// 搜索关键词验证
export const SearchKeywordZod = z.object({
  keyword: z.string().min(1, '搜索关键词不能为空').max(200, '搜索关键词不能超过 200 个字符'),
});

// 反应相关验证
export const ReactionCreateZod = z.object({
  type: z.string().min(1, '反应类型不能为空').max(50, '反应类型不能超过 50 个字符'), // emoji 通常很短，但留一些余量
  roteid: z.uuid('无效的笔记 ID'),
  visitorId: z.string().max(200, '访客 ID 不能超过 200 个字符').optional(),
  visitorInfo: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 附件文件名验证
export const AttachmentPresignZod = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().max(255, '文件名不能超过 255 个字符').optional(),
        contentType: z.string().min(1, '内容类型不能为空'),
        size: z.number().int().positive('文件大小必须大于 0'),
      })
    )
    .min(1, '至少需要一个文件')
    .max(9, '最多只能上传 9 个文件'),
});
