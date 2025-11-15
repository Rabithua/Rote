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
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
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
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  oldpassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(128, 'Password cannot exceed 128 characters'),
});
