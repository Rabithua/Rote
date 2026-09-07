import messages from './messages.json';

export const OAUTH_MCP_SCOPES = [
  'notes:read',
  'notes:write',
  'notes:delete',
  'notes:share',
  'articles:read',
  'articles:write',
  'articles:delete',
  'reactions:write',
  'reactions:delete',
  'profile:read',
  'profile:write',
  'stats:read',
  'settings:read',
  'settings:write',
  'attachments:write',
  'attachments:delete',
  'video:upload',
] as const;

export type OAuthMcpScope = (typeof OAUTH_MCP_SCOPES)[number];

export const DEFAULT_OAUTH_MCP_SCOPES: OAuthMcpScope[] = [
  'notes:read',
  'notes:write',
  'articles:read',
  'profile:read',
];

const SCOPE_SET = new Set<string>(OAUTH_MCP_SCOPES);

export function parseScope(scope: unknown, fallback: string[] = []): string[] {
  if (typeof scope !== 'string') {
    return fallback;
  }

  return Array.from(
    new Set(
      scope
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function validateOAuthScopes(scopes: string[]): string[] {
  const invalid = scopes.filter((scope) => !SCOPE_SET.has(scope));
  if (invalid.length > 0) {
    throw new Error(messages.codes.scopeInvalidPrefix + invalid.join(','));
  }
  return scopes;
}

export function formatScope(scopes: string[]): string {
  return Array.from(new Set(scopes)).join(' ');
}

export function hasRequiredScopes(granted: string[], required: string[]): boolean {
  return required.every((scope) => granted.includes(scope));
}
