export type ApnsEnvironment = 'sandbox' | 'production';

export function isPushNotificationsEnabled(): boolean {
  return process.env.PUSH_NOTIFICATIONS_ENABLED === 'true';
}

export function assertPushNotificationsEnabled(): void {
  if (!isPushNotificationsEnabled()) {
    throw new Error('Push notifications are not enabled for this deployment');
  }
}

export function validateTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return timeZone;
  } catch {
    throw new Error('Invalid IANA time zone');
  }
}

export function getApnsConfig(environment: ApnsEnvironment) {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const topic = process.env.APNS_TOPIC;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!keyId || !teamId || !topic || !privateKey) {
    throw new Error('APNs credentials are incomplete');
  }
  return {
    keyId,
    teamId,
    topic,
    privateKey,
    origin:
      environment === 'production'
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com',
  };
}
