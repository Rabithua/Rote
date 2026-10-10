export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ChatParameterConfig {
  model: string;
  reasoningEffort?: ReasoningEffort | null;
}

// OpenAI-compatible transport does not imply identical model parameters.
// Keep this model policy aligned with the browser client in web/src/utils/chatParameters.ts.
export function buildChatParameters(config: ChatParameterConfig, temperature: number) {
  const model = config.model.trim().toLowerCase().split('/').pop() || '';
  const effort = config.reasoningEffort === undefined ? 'high' : config.reasoningEffort;
  const openaiReasoning =
    /^(o1|o3|o4-mini)(?:-|$)/.test(model) &&
    !/^(o1-mini|o1-preview|o1-pro|o3-pro)(?:-|$)/.test(model);
  const gptReasoning = /^gpt-5(?:[.-]|$)/.test(model) && !model.includes('chat');

  if (openaiReasoning || gptReasoning) {
    return {
      ...(effort ? { reasoning_effort: model.includes('-pro') ? 'high' : effort } : {}),
    };
  }

  const glm = /^glm-5\.[23](?:-|$)/.test(model);
  const deepseek = /^deepseek-(?:flash|v4-pro)(?:-|$)/.test(model);
  return {
    temperature,
    ...(effort && (glm || deepseek)
      ? {
          reasoning_effort:
            effort === 'medium' || (model.startsWith('glm-5.2') && effort === 'low')
              ? 'high'
              : effort,
        }
      : {}),
  };
}
