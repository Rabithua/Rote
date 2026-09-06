import type { RetrievalSelection } from '../../ai/retrievalPlan';

export type AiSourceType = 'rote' | 'article';
export type EmbeddingJobAction = 'upsert' | 'delete' | 'reindex';
export type EmbeddingJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type {
  NormalizedTimeRange,
  PlannerAgentDto,
  PlannerAgentResult,
  RetrievalDateField,
  RetrievalSelection,
  RetrievalScope,
  RetrievalSnippet,
  RetrievalTimeContext,
  RetrievalToolResult,
  SearchRotesArgs,
  SearchRotesProbeResult,
} from '../../ai/retrievalPlan';

export interface SemanticSearchResult {
  id: string;
  ownerId: string;
  sourceType: AiSourceType;
  sourceId: string;
  chunkIndex: number;
  text: string;
  similarity: number;
  retrievalMode?: RetrievalSelection;
  metadata: any;
}
