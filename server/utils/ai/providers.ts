import type { AiConfig, AiProviderConfig } from '../../types/config';

export type AiProviderCapability = 'chat' | 'embedding';

export interface AiProviderPreset {
  id: string;
  name: string;
  apiFormat: 'openai_compatible';
  baseUrl: string;
  capabilities: AiProviderCapability[];
  chatModels: string[];
  embeddingModels: string[];
  requiresApiKey: boolean;
}

export const MASKED_API_KEY = '********';

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    capabilities: ['chat', 'embedding'],
    chatModels: ['gpt-4.1-mini', 'gpt-4o-mini'],
    embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large'],
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    capabilities: ['chat'],
    chatModels: ['openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4'],
    embeddingModels: [],
    requiresApiKey: true,
  },
  {
    id: 'orcarouter',
    name: 'OrcaRouter',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.orcarouter.ai/v1',
    capabilities: ['chat', 'embedding'],
    chatModels: ['orcarouter/auto', 'anthropic/claude-sonnet-4.6'],
    embeddingModels: ['openai/text-embedding-3-small', 'openai/text-embedding-3-large'],
    requiresApiKey: true,
  },
  {
    id: 'ollama',
    name: 'Ollama / LM Studio',
    apiFormat: 'openai_compatible',
    baseUrl: 'http://localhost:11434/v1',
    capabilities: ['chat', 'embedding'],
    chatModels: ['llama3.1', 'qwen2.5'],
    embeddingModels: ['nomic-embed-text', 'bge-m3'],
    requiresApiKey: false,
  },
  {
    id: 'llama-cpp',
    name: 'llama.cpp (local)',
    apiFormat: 'openai_compatible',
    baseUrl: 'http://127.0.0.1:8080/v1',
    capabilities: ['chat'],
    chatModels: ['gemma-4-12b-it'],
    embeddingModels: [],
    requiresApiKey: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    capabilities: ['chat'],
    chatModels: ['deepseek-chat', 'deepseek-reasoner'],
    embeddingModels: [],
    requiresApiKey: true,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    capabilities: ['chat', 'embedding'],
    chatModels: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'],
    embeddingModels: ['BAAI/bge-m3', 'Pro/BAAI/bge-m3'],
    requiresApiKey: true,
  },
  {
    id: 'dashscope',
    name: 'DashScope / Qwen',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    capabilities: ['chat', 'embedding'],
    chatModels: ['qwen-plus', 'qwen-turbo'],
    embeddingModels: ['text-embedding-v4', 'text-embedding-v3'],
    requiresApiKey: true,
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    capabilities: ['chat', 'embedding'],
    chatModels: ['glm-4-flash', 'glm-4-plus'],
    embeddingModels: ['embedding-3'],
    requiresApiKey: true,
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    capabilities: ['chat'],
    chatModels: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    embeddingModels: [],
    requiresApiKey: true,
  },
  {
    id: 'volcengine',
    name: 'Volcengine Ark / Doubao',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    capabilities: ['chat', 'embedding'],
    chatModels: ['doubao-seed-1-6'],
    embeddingModels: ['doubao-embedding-text'],
    requiresApiKey: true,
  },
  {
    id: 'tencent-hunyuan',
    name: 'Tencent Hunyuan',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    capabilities: ['chat', 'embedding'],
    chatModels: ['hunyuan-turbos-latest'],
    embeddingModels: ['hunyuan-embedding'],
    requiresApiKey: true,
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible',
    apiFormat: 'openai_compatible',
    baseUrl: '',
    capabilities: ['chat', 'embedding'],
    chatModels: [],
    embeddingModels: [],
    requiresApiKey: false,
  },
];

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  vectorEnabled: false,
  autoIndexEnabled: false,
  publicExploreVectorEnabled: false,
  chat: {
    providerId: 'openai',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    apiKey: '',
  },
  embedding: {
    providerId: 'openai',
    apiFormat: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    apiKey: '',
  },
  indexing: {
    chunkSize: 1800,
    chunkOverlap: 200,
    batchSize: 5,
    maxRetries: 3,
    paused: false,
  },
};

export function mergeAiConfig(config?: Partial<AiConfig> | null): AiConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    ...(config || {}),
    chat: {
      ...DEFAULT_AI_CONFIG.chat,
      ...(config?.chat || {}),
      apiFormat: 'openai_compatible',
    },
    embedding: {
      ...DEFAULT_AI_CONFIG.embedding,
      ...(config?.embedding || {}),
      apiFormat: 'openai_compatible',
    },
    indexing: {
      ...DEFAULT_AI_CONFIG.indexing,
      ...(config?.indexing || {}),
    },
  };
}

export function sanitizeProviderConfig<T extends AiProviderConfig>(provider: T): T {
  if (!provider.apiKey) return provider;
  return {
    ...provider,
    apiKey: MASKED_API_KEY,
  };
}

export function sanitizeAiConfig(config?: Partial<AiConfig> | null): AiConfig {
  const merged = mergeAiConfig(config);
  return {
    ...merged,
    chat: sanitizeProviderConfig(merged.chat),
    embedding: sanitizeProviderConfig(merged.embedding),
  };
}

export function resolveIncomingAiConfig(
  incoming: Partial<AiConfig>,
  existing?: Partial<AiConfig> | null
): AiConfig {
  const mergedExisting = mergeAiConfig(existing);
  const next = mergeAiConfig(incoming);

  if (incoming.chat?.apiKey === MASKED_API_KEY) {
    next.chat.apiKey = mergedExisting.chat.apiKey;
  }
  if (incoming.embedding?.apiKey === MASKED_API_KEY) {
    next.embedding.apiKey = mergedExisting.embedding.apiKey;
  }

  return next;
}
