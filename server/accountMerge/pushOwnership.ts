import { eq, sql } from 'drizzle-orm';
import {
  apnsDevices,
  pushEvents,
  pushCampaigns,
  pushPreferences,
  userSwSubscriptions,
} from '../drizzle/schema';
import type { AccountMergeTransaction, MergedAccountData } from './types';

export async function transferPushOwnership(
  tx: AccountMergeTransaction,
  sourceUserId: string,
  targetUserId: string,
  mergedData: MergedAccountData
): Promise<void> {
  // 7. 合并推送订阅（endpoint 唯一，需要处理冲突）
  const sourceSubscriptions = await tx
    .select()
    .from(userSwSubscriptions)
    .where(eq(userSwSubscriptions.userid, sourceUserId));

  for (const sub of sourceSubscriptions) {
    const [existing] = await tx
      .select()
      .from(userSwSubscriptions)
      .where(eq(userSwSubscriptions.endpoint, sub.endpoint))
      .limit(1);

    if (existing && existing.userid === targetUserId) {
      await tx.delete(userSwSubscriptions).where(eq(userSwSubscriptions.id, sub.id));
    } else {
      await tx
        .update(userSwSubscriptions)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(userSwSubscriptions.id, sub.id));
      mergedData.subscriptions++;
    }
  }

  // Preserve native push registrations, delivery foreign keys, and queued
  // events. Preferences follow the same target-wins rule as user settings.
  const migratedApnsDevices = await tx
    .update(apnsDevices)
    .set({ userid: targetUserId, updatedAt: new Date() })
    .where(eq(apnsDevices.userid, sourceUserId))
    .returning({ id: apnsDevices.id });
  mergedData.apnsDevices = migratedApnsDevices.length;

  await tx
    .update(pushCampaigns)
    .set({ createdBy: targetUserId, updatedAt: new Date() })
    .where(eq(pushCampaigns.createdBy, sourceUserId));

  // Campaigns and daily reminders are created once per account. Collapse
  // duplicate logical events onto the target copy, preserve sent-device
  // coverage, and requeue the target so fan-out fills only missing devices
  // after registrations move to the combined account.
  await tx.execute(sql`
  WITH duplicate_pairs AS MATERIALIZED (
    SELECT source.id AS source_id, target.id AS target_id
    FROM push_events source
    JOIN push_events target
      ON target.userid = ${targetUserId}::uuid
      AND target.type = source.type
      AND target.status IN ('pending', 'processed')
      AND (
        (
          source.type = 'system.campaign'
          AND target.payload->>'campaignId' = source.payload->>'campaignId'
        )
        OR (
          source.type = 'habit.daily_record_reminder'
          AND split_part(target."dedupeKey", ':', 3) = split_part(source."dedupeKey", ':', 3)
        )
      )
    WHERE source.userid = ${sourceUserId}::uuid
      AND source.status IN ('pending', 'processed')
  ), preserved_sent AS (
    INSERT INTO push_deliveries
      ("eventId", "deviceId", status, "attemptCount", "nextAttemptAt", "apnsId",
       "lastError", "sentAt", "createdAt", "updatedAt")
    SELECT pair.target_id, delivery."deviceId", delivery.status, delivery."attemptCount",
      delivery."nextAttemptAt", delivery."apnsId", delivery."lastError", delivery."sentAt",
      delivery."createdAt", delivery."updatedAt"
    FROM duplicate_pairs pair
    JOIN push_deliveries delivery ON delivery."eventId" = pair.source_id
    WHERE delivery.status = 'sent'
    ON CONFLICT ("eventId", "deviceId") DO NOTHING
  ), requeued_targets AS (
    UPDATE push_events target
    SET status = 'pending', "updatedAt" = now()
    WHERE target.id IN (SELECT target_id FROM duplicate_pairs)
  ), cancelled_deliveries AS (
    UPDATE push_deliveries delivery
    SET status = 'cancelled', "lastError" = 'account_merge_duplicate_event', "updatedAt" = now()
    WHERE delivery."eventId" IN (SELECT source_id FROM duplicate_pairs)
      AND delivery.status IN ('pending', 'retry', 'processing')
  )
  UPDATE push_events event
  SET status = 'cancelled', "updatedAt" = now()
  WHERE event.id IN (SELECT source_id FROM duplicate_pairs)
`);

  const migratedPushEvents = await tx
    .update(pushEvents)
    .set({ userid: targetUserId, updatedAt: new Date() })
    .where(eq(pushEvents.userid, sourceUserId))
    .returning({ id: pushEvents.id });
  mergedData.pushEvents = migratedPushEvents.length;

  const [sourcePushPreferences] = await tx
    .select()
    .from(pushPreferences)
    .where(eq(pushPreferences.userid, sourceUserId))
    .limit(1);
  const [targetPushPreferences] = await tx
    .select({ userid: pushPreferences.userid })
    .from(pushPreferences)
    .where(eq(pushPreferences.userid, targetUserId))
    .limit(1);
  if (sourcePushPreferences && targetPushPreferences) {
    await tx.delete(pushPreferences).where(eq(pushPreferences.userid, sourceUserId));
  } else if (sourcePushPreferences) {
    await tx
      .update(pushPreferences)
      .set({ userid: targetUserId, updatedAt: new Date() })
      .where(eq(pushPreferences.userid, sourceUserId));
  }
}
