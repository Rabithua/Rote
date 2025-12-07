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
    .refine((val) => val.length > 0, { message: 'Password cannot be empty' })
    .refine((val) => val.length >= 6, { message: 'Password must be at least 6 characters' })
    .max(128, 'Password cannot exceed 128 characters'),
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
    .refine((val) => val.length > 0, { message: 'Password cannot be empty' })
    .refine((val) => val.length >= 6, { message: 'Password must be at least 6 characters' })
    .max(128, 'Password cannot exceed 128 characters'),
  oldpassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(128, 'Password cannot exceed 128 characters'),
});

// 笔记相关验证
export const NoteCreateZod = z.object({
  title: z.string().max(200, 'Title cannot exceed 200 characters').optional(),
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(1000000, 'Content cannot exceed 1,000,000 characters'), // 约 1MB 文本
  type: z.string().optional(),
  tags: z
    .array(
      z.string().min(1, 'Tag cannot be empty').max(50, 'Single tag cannot exceed 50 characters')
    )
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
  state: z.string().optional(),
  archived: z.boolean().optional(),
  pin: z.boolean().optional(),
  editor: z.string().optional(),
  attachmentIds: z.array(z.string().uuid('Invalid attachment ID')).optional(),
});

export const NoteUpdateZod = z.object({
  title: z.string().max(200, 'Title cannot exceed 200 characters').optional(),
  content: z.string().max(1000000, 'Content cannot exceed 1,000,000 characters').optional(),
  type: z.string().optional(),
  tags: z
    .array(
      z.string().min(1, 'Tag cannot be empty').max(50, 'Single tag cannot exceed 50 characters')
    )
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
  state: z.string().optional(),
  archived: z.boolean().optional(),
  pin: z.boolean().optional(),
  editor: z.string().optional(),
  attachmentIds: z.array(z.string().uuid('Invalid attachment ID')).optional(),
});

// 搜索关键词验证
export const SearchKeywordZod = z.object({
  keyword: z
    .string()
    .min(1, 'Search keyword cannot be empty')
    .max(200, 'Search keyword cannot exceed 200 characters'),
});

// 反应相关验证
export const ReactionCreateZod = z.object({
  type: z
    .string()
    .min(1, 'Reaction type cannot be empty')
    .max(50, 'Reaction type cannot exceed 50 characters'), // emoji 通常很短，但留一些余量
  roteid: z.uuid('Invalid note ID'),
  visitorId: z.string().max(200, 'Visitor ID cannot exceed 200 characters').optional(),
  visitorInfo: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 附件文件名验证
export const AttachmentPresignZod = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().max(255, 'Filename cannot exceed 255 characters').optional(),
        contentType: z.string().min(1, 'Content type cannot be empty'),
        size: z.number().int().positive('File size must be greater than 0'),
      })
    )
    .min(1, 'At least one file is required')
    .max(9, 'Maximum 9 files allowed'),
});
