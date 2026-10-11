import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthState } from '@/state/profile';
import { getApiUrl } from '@/utils/api';
import { authService } from '@/utils/auth';
import { activateAiConversationScope, setAiConversationInterruptedLabel } from './runtime';
import { conversationScope } from './storage';

/** Keep generation/cache ownership aligned even after navigating away from the chat page. */
export function AiConversationSession() {
  const { tokenValid } = useAuthState();
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const site = getApiUrl();
  const token = authService.getAccessToken() || authService.getRefreshToken();
  const userId = tokenValid && token ? authService.getUserInfoFromToken(token)?.userId : undefined;
  const interrupted = useEffectEvent(() => t('messages.interrupted'));
  useEffect(() => {
    setAiConversationInterruptedLabel(t('messages.interrupted'));
  }, [t]);
  useEffect(() => {
    void activateAiConversationScope(
      userId ? conversationScope(site, userId) : null,
      interrupted()
    );
    return () => {
      void activateAiConversationScope(null, interrupted());
    };
  }, [site, userId]);
  return null;
}
