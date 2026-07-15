import type { AiAgentPhase, AiAgentToolProgressStatus } from '@/utils/aiApi';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function useAiRunLabels() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });

  return useMemo(
    () => ({
      phase: (phase: AiAgentPhase) => t(`timeline.phases.${phase}`),
      toolStarted: (toolName: string) =>
        t(`timeline.tools.${toolName}`, { defaultValue: toolName }),
      toolStatus: (status: AiAgentToolProgressStatus) => t(`timeline.toolStatus.${status}`),
      toolFinished: (toolName: string) =>
        t(`timeline.toolDone.${toolName}`, {
          defaultValue: t('timeline.toolDone.default'),
        }),
      sourcesFound: (count: number) => t('timeline.sourcesFound', { count }),
      askFailed: t('messages.askFailed'),
      streamInterrupted: t('messages.streamInterrupted'),
      streamTimeout: t('messages.streamTimeout'),
      streamTruncated: t('messages.streamTruncated'),
      fallbackNoAnswerWithSources: t('messages.fallbackNoAnswerWithSources'),
      fallbackNoAnswerNoSources: t('messages.fallbackNoAnswerNoSources'),
    }),
    [t]
  );
}
