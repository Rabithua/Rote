import copy from './copy.json';

export type PreviewScenario = keyof typeof copy.zh.scenarios;
export const scenarioNames = Object.keys(copy.zh.scenarios) as PreviewScenario[];
export const previewCopy = copy.zh;

export function readScenario(cookie = ''): PreviewScenario {
  const value = cookie.match(/(?:^|;\s*)rote-auth-preview=([^;]+)/)?.[1];
  return scenarioNames.includes(value as PreviewScenario) ? (value as PreviewScenario) : 'all';
}

export function siteStatus(scenario: PreviewScenario) {
  const oauthEnabled = !['legacy', 'passkey'].includes(scenario);
  return {
    isInitialized: true,
    databaseConnected: true,
    site: { name: 'Rote', description: '', defaultLanguage: 'zh', url: '' },
    system: { version: 'preview', lastMigration: '' },
    notification: { vapidPublicKey: null },
    storage: { r2Configured: false, urlPrefix: '' },
    ui: { allowRegistration: scenario !== 'closed', allowUploadFile: false },
    oauth: {
      enabled: oauthEnabled,
      providers: { github: { enabled: oauthEnabled }, apple: { enabled: oauthEnabled } },
    },
    passkey: { enabled: !['legacy', 'oauth'].includes(scenario) },
    ai: { enabled: false, available: false },
    frontendConfig: {
      preReactions: [],
      anonymousPreReactions: [],
      permissionKeys: [],
      roteMaxLetter: 100000,
      roteContentExpandedLetter: 500,
      safeRoutes: ['login', 'home', 'admin', 'profile', 'oauth'],
    },
  };
}

export function previewProfile(username: string, email: string | null = null) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    username,
    nickname: username,
    email,
    certified: false,
    role: 'user',
    avatar: null,
    cover: null,
    description: null,
    hasPassword: Boolean(email),
    oauthBindings: [],
    allowExplore: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function previewTokens(username: string, email: string | null = null) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      email,
      userId: '11111111-1111-4111-8111-111111111111',
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  ).toString('base64url');
  const token = `eyJhbGciOiJub25lIn0.${payload}.preview`;
  return { user: previewProfile(username, email), accessToken: token, refreshToken: token };
}

export function profileFromToken(authorization = '') {
  const payload = authorization.split('.')[1];
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      username: string;
      email: string | null;
    };
    return previewProfile(data.username, data.email);
  } catch {
    return null;
  }
}
