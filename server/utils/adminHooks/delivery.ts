import type { AdminHookChannel, NotificationConfig } from '../../types/config';
import { getGlobalConfig } from '../config';
import db from '../drizzle';
import { updateSubScription } from '../dbMethods/subscription';
import webpush from '../webpush';
import { assertSafeOutboundUrl, normalizeUrlBase } from './network';
import { bodyForEnvelope, titleForEnvelope, urlForEnvelope } from './presentation';
import {
  DEFAULT_BARK_SERVER_URL,
  REQUEST_TIMEOUT_MS,
  type AdminHookDeliveryResult,
  type AdminHookDeliverySummary,
  type AdminHookEnvelope,
} from './types';

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendBark(
  channel: Extract<AdminHookChannel, { type: 'bark' }>,
  envelope: AdminHookEnvelope
) {
  const serverUrl = normalizeUrlBase(channel.serverUrl || DEFAULT_BARK_SERVER_URL);
  await assertSafeOutboundUrl(serverUrl, 'Bark server URL');

  const title = titleForEnvelope(envelope);
  const body = bodyForEnvelope(envelope);
  const target = new URL(
    `${serverUrl}/${encodeURIComponent(channel.key)}/${encodeURIComponent(title)}/${encodeURIComponent(
      body || envelope.event
    )}`
  );
  const clickUrl = urlForEnvelope(envelope);
  if (clickUrl) target.searchParams.set('url', clickUrl);
  if (channel.group) target.searchParams.set('group', channel.group);
  if (channel.icon) target.searchParams.set('icon', channel.icon);
  if (channel.sound) target.searchParams.set('sound', channel.sound);

  const response = await fetchWithTimeout(target.toString(), { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Bark request failed with ${response.status}: ${response.statusText}`);
  }
  return { status: response.status, statusText: response.statusText };
}

async function sendHttp(
  channel: Extract<AdminHookChannel, { type: 'http' }>,
  envelope: AdminHookEnvelope
) {
  await assertSafeOutboundUrl(channel.url, 'HTTP hook URL');

  const response = await fetchWithTimeout(channel.url, {
    body: JSON.stringify(envelope),
    headers: {
      'content-type': 'application/json',
      ...(channel.headers || {}),
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`HTTP hook failed with ${response.status}: ${response.statusText}`);
  }
  return { status: response.status, statusText: response.statusText };
}

async function sendAdminPwa(envelope: AdminHookEnvelope) {
  if (!webpush?.sendNotification) {
    throw new Error('Web push service is not configured');
  }

  const subscriptions = await db.query.userSwSubscriptions.findMany({
    where: (subscriptions, { eq }) => eq(subscriptions.status, 'active'),
    with: {
      user: {
        columns: {
          id: true,
          nickname: true,
          role: true,
          username: true,
        },
      },
    },
  });
  const adminSubscriptions = subscriptions.filter((subscription) =>
    ['admin', 'super_admin'].includes(subscription.user?.role)
  );

  let success = 0;
  let failed = 0;
  for (const subscription of adminSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify({
          body: bodyForEnvelope(envelope) || envelope.event,
          data: {
            event: envelope.event,
            noteId: envelope.note?.id,
            type: 'admin_hook',
            url: urlForEnvelope(envelope),
          },
          title: titleForEnvelope(envelope),
        })
      );
      success++;
    } catch (error: any) {
      failed++;
      if ([400, 403, 404, 410].includes(error?.statusCode)) {
        await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
      }
    }
  }

  return {
    failed,
    success,
    total: adminSubscriptions.length,
  };
}

async function sendToChannel(
  channel: AdminHookChannel,
  envelope: AdminHookEnvelope
): Promise<AdminHookDeliveryResult> {
  if (!channel.enabled || !channel.events.includes(envelope.event)) {
    return {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      status: 'skipped',
    };
  }

  try {
    const details =
      channel.type === 'bark'
        ? await sendBark(channel, envelope)
        : channel.type === 'http'
          ? await sendHttp(channel, envelope)
          : await sendAdminPwa(envelope);
    return {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      details,
      status: 'success',
    };
  } catch (error: any) {
    return {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      error: error?.message || String(error || envelope.event),
      status: 'failed',
    };
  }
}

export async function sendAdminHookEnvelope(
  envelope: AdminHookEnvelope,
  channels?: AdminHookChannel[]
): Promise<AdminHookDeliverySummary> {
  const notificationConfig = getGlobalConfig<NotificationConfig>('notification');
  const adminHooks = notificationConfig?.adminHooks;
  if (!channels && (!adminHooks?.enabled || !adminHooks.channels?.length)) {
    return {
      event: envelope.event,
      results: [],
      summary: { failed: 0, skipped: 0, success: 0 },
      totalChannels: 0,
    };
  }

  const targetChannels = channels || adminHooks?.channels || [];
  const results = await Promise.all(
    targetChannels.map((channel) => sendToChannel(channel, envelope))
  );
  return {
    event: envelope.event,
    results,
    summary: {
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      success: results.filter((result) => result.status === 'success').length,
    },
    totalChannels: targetChannels.length,
  };
}
