export interface ChatParameterConfig {
  model: string;
  providerId?: string;
  baseUrl?: string;
}

// Thinking is a product default; callers and saved settings cannot disable it.
// Browser and server policy parity is checked in tests.
export function buildChatParameters(config: ChatParameterConfig, temperature: number) {
  const model = config.model.trim().toLowerCase().split('/').pop() || '';
  const openaiReasoning =
    /^(o1|o3|o4-mini)(?:-|$)/.test(model) &&
    !/^(o1-mini|o1-preview|o1-pro|o3-pro)(?:-|$)/.test(model);
  const gptReasoning = /^gpt-5(?:[.-]|$)/.test(model) && !model.includes('chat');
  if (openaiReasoning || gptReasoning) {
    return { reasoning_effort: 'high' as const };
  }

  const glmEffort = /^glm-5\.[23](?:-|$)/.test(model);
  const glmThinking =
    /^glm-(?:4\.[567]|5(?:\.[123])?)(?:-|$)/.test(model) && !model.includes('airx');
  const deepseek = /^deepseek-(?:flash|v4-pro)(?:-|$)/.test(model);
  const dashscope =
    config.providerId === 'dashscope' ||
    /^https?:\/\/(?:dashscope(?:-intl|-us)?|[a-z0-9.-]+\.maas)\.aliyuncs\.com(?:[:/]|$)/i.test(
      config.baseUrl || ''
    );
  return {
    temperature,
    ...(glmEffort || deepseek ? { reasoning_effort: 'high' as const } : {}),
    ...(dashscope
      ? { enable_thinking: true }
      : glmThinking || deepseek
        ? { thinking: { type: 'enabled' as const } }
        : {}),
  };
}
