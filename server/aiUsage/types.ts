export type AiUsagePurpose =
  | 'chat_plan'
  | 'chat_tool_decision'
  | 'chat_answer'
  | 'embedding_query'
  | 'embedding_index'
  | 'provider_test'
  | 'index_validation';

export interface AiUsageContext {
  userId?: string;
  purpose: AiUsagePurpose;
}

export interface AiUsageValues {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  reasoningTokens: number | null;
}

export interface AiUsageRecord extends AiUsageValues {
  requestId: string;
  userid: string | null;
  providerId: string;
  model: string;
  type: 'chat' | 'embedding';
  purpose: AiUsagePurpose;
  status: 'completed' | 'failed' | 'cancelled';
  usageStatus: 'reported' | 'unknown';
  createdAt: Date;
}
