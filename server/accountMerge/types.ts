import type { User } from '../drizzle/schema';
import type db from '../utils/drizzle';

export type AccountMergeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type MergeAccounts = { source: User; target: User };
export interface MergedAccountData {
  notes: number;
  attachments: number;
  reactions: number;
  openKeys: number;
  subscriptions: number;
  apnsDevices: number;
  pushEvents: number;
  changes: number;
  aiConversations: number;
}
export interface AccountMergeResult {
  success: boolean;
  mergedData: MergedAccountData;
  migratedBindings: Array<{ provider: string; providerId: string }>;
}
export interface OAuthMergeIdentity {
  sourceUserId: string;
  targetUserId: string;
  provider: string;
  providerId: string;
}
