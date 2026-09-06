import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';

export function formatEmbeddingError(
  error: unknown,
  t: TFunction<'translation', 'pages.admin'>
): string | null {
  if (!isAxiosError<{ message?: string; data?: Record<string, string | number> }>(error))
    return null;
  const message = error.response?.data?.message;
  if (typeof message !== 'string' || !message.startsWith('embedding_')) return null;
  return t(`ai.embeddingErrors.${message}`, {
    ...(error.response?.data?.data || {}),
    defaultValue: t('ai.embeddingErrors.embedding_job_failed'),
  });
}
