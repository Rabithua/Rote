export interface AiUsageMetrics {
  totalTokens: string;
  promptTokens: string;
  completionTokens: string;
  calls: number;
  reportedCalls: number;
  unknownCalls: number;
  legacyRecords: number;
  failedCalls: number;
  cancelledCalls: number;
  cacheHitTokens: string | null;
  cacheMissTokens: string | null;
  reasoningTokens: string | null;
  cacheHitReportedCalls: number;
  cacheMissReportedCalls: number;
  reasoningReportedCalls: number;
}

export interface AiUsageStatistics {
  range: { startAt: string; endAt: string; timeZone: string };
  summary: AiUsageMetrics;
  system: AiUsageMetrics;
  unattributed: AiUsageMetrics;
  models: { providerId: string | null; model: string; type: string; metrics: AiUsageMetrics }[];
  topUsers: { id: string; username: string; avatar: string | null; metrics: AiUsageMetrics }[];
  availableModels: string[];
}

export interface AiUsageUsersResponse {
  users: AiUsageStatistics['topUsers'];
  pagination: { page: number; limit: number; total: number; pages: number };
}
