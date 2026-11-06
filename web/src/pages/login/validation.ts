import { z } from 'zod';

type LoginTranslator = (key: string) => string;

export type LoginSiteStatus = {
  frontendConfig?: {
    safeRoutes?: string[];
  };
} | null;

export function createUsernameDataSchema(t: LoginTranslator, siteStatus?: LoginSiteStatus) {
  return z.object({
    username: z
      .string()
      .min(1, t('usernameRequired'))
      .max(20, t('usernameMaxLength'))
      .regex(/^[A-Za-z0-9_-]+$/, t('usernameFormat'))
      .refine((value) => !siteStatus?.frontendConfig?.safeRoutes?.includes(value), {
        message: t('usernameConflict'),
      }),
  });
}

export function createLoginDataSchema(t: LoginTranslator) {
  return z.object({
    username: z
      .string()
      .min(1, t('usernameOrEmailRequired'))
      .superRefine((val, ctx) => {
        if (val.includes('@')) {
          const emailResult = z.string().email().safeParse(val);
          if (!emailResult.success) {
            ctx.addIssue({ code: 'custom', message: t('emailFormat') });
          }
        } else if (val.length > 20) {
          ctx.addIssue({ code: 'custom', message: t('usernameMaxLength') });
        }
      }),
    password: z
      .string()
      .min(1, t('passwordRequired'))
      .min(6, t('passwordMin'))
      .max(128, t('passwordMaxLength')),
  });
}

export function createRegisterDataSchema({
  t,
  siteStatus,
}: {
  t: LoginTranslator;
  siteStatus: LoginSiteStatus;
}) {
  return createUsernameDataSchema(t, siteStatus).extend({
    password: z
      .string()
      .min(1, t('passwordRequired'))
      .min(6, t('passwordMin'))
      .max(128, t('passwordMaxLength')),
    email: z
      .string()
      .min(1, t('emailRequired'))
      .max(255, t('emailMaxLength'))
      .email(t('emailFormat')),
    nickname: z.string().min(1, t('nicknameRequired')).max(20, t('nicknameMaxLength')),
  });
}

export function getZodErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message || fallbackMessage;
  return fallbackMessage;
}
