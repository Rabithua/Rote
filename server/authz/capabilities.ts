import { UserRole } from '../types/main';

export const CAPABILITY_KEYS = [
  'attachment.upload',
  'attachment.video.upload',
  'ai.chat',
  'resource.storage.unlimited',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];
export type CapabilityEffect = 'allow' | 'deny';
export type CapabilityOverride = CapabilityEffect | 'inherit';
export type CapabilitySource =
  | 'user_override'
  | 'subscription'
  | 'role_policy'
  | 'role_default'
  | 'dependency';

export type EffectiveCapability = {
  allowed: boolean;
  source: CapabilitySource;
  role: string;
  validUntil?: string;
};

export type EffectiveCapabilities = Record<CapabilityKey, EffectiveCapability>;

const USER_DEFAULTS: Record<CapabilityKey, boolean> = {
  'attachment.upload': true,
  'attachment.video.upload': false,
  'ai.chat': false,
  'resource.storage.unlimited': false,
};

const ADMIN_DEFAULTS: Record<CapabilityKey, boolean> = {
  'attachment.upload': true,
  'attachment.video.upload': true,
  'ai.chat': true,
  'resource.storage.unlimited': true,
};

export const ROLE_DEFAULT_CAPABILITIES: Record<string, Record<CapabilityKey, boolean>> = {
  [UserRole.USER]: USER_DEFAULTS,
  [UserRole.MODERATOR]: USER_DEFAULTS,
  [UserRole.ADMIN]: ADMIN_DEFAULTS,
  [UserRole.SUPER_ADMIN]: ADMIN_DEFAULTS,
};

export const CAPABILITY_DEPENDENCIES: Partial<Record<CapabilityKey, CapabilityKey[]>> = {
  'attachment.video.upload': ['attachment.upload'],
};

export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === 'string' && CAPABILITY_KEYS.includes(value as CapabilityKey);
}

export function isCapabilityEffect(value: unknown): value is CapabilityEffect {
  return value === 'allow' || value === 'deny';
}

export function isCapabilityOverride(value: unknown): value is CapabilityOverride {
  return value === 'inherit' || isCapabilityEffect(value);
}

export function getRoleDefaultCapability(role: string, capability: CapabilityKey): boolean {
  return ROLE_DEFAULT_CAPABILITIES[role]?.[capability] ?? false;
}

export function resolveEffectiveCapabilities(params: {
  role: string;
  rolePolicies?: Partial<Record<CapabilityKey, CapabilityEffect>>;
  userOverrides?: Partial<Record<CapabilityKey, CapabilityEffect>>;
  subscription?: {
    status?: unknown;
    capabilities?: unknown;
    validUntil?: unknown;
  };
  now?: Date;
}): EffectiveCapabilities {
  const { role, rolePolicies = {}, userOverrides = {} } = params;
  const subscriptionValidUntil = getSubscriptionValidUntil(params.subscription, params.now);
  const subscriptionCapabilities = new Set(
    subscriptionValidUntil && Array.isArray(params.subscription?.capabilities)
      ? params.subscription.capabilities.filter(isCapabilityKey)
      : []
  );
  const capabilities = Object.fromEntries(
    CAPABILITY_KEYS.map((capability) => {
      if (role === UserRole.SUPER_ADMIN) {
        return [capability, { allowed: true, source: 'role_default', role }];
      }

      const userEffect = userOverrides[capability];
      if (userEffect) {
        return [capability, { allowed: userEffect === 'allow', source: 'user_override', role }];
      }

      if (subscriptionValidUntil && subscriptionCapabilities.has(capability)) {
        return [
          capability,
          {
            allowed: true,
            source: 'subscription',
            role,
            validUntil: subscriptionValidUntil,
          },
        ];
      }

      const roleEffect = rolePolicies[capability];
      if (roleEffect) {
        return [capability, { allowed: roleEffect === 'allow', source: 'role_policy', role }];
      }

      return [
        capability,
        {
          allowed: getRoleDefaultCapability(role, capability),
          source: 'role_default',
          role,
        },
      ];
    })
  ) as EffectiveCapabilities;

  for (const capability of CAPABILITY_KEYS) {
    const dependencies = CAPABILITY_DEPENDENCIES[capability] || [];
    if (
      capabilities[capability].allowed &&
      dependencies.some((dependency) => !capabilities[dependency].allowed)
    ) {
      capabilities[capability] = {
        allowed: false,
        source: 'dependency',
        role,
      };
    }
  }

  return capabilities;
}

function getSubscriptionValidUntil(
  subscription:
    | {
        status?: unknown;
        validUntil?: unknown;
      }
    | undefined,
  now: Date = new Date()
): string | null {
  if (
    (subscription?.status !== 'active' && subscription?.status !== 'grace_period') ||
    typeof subscription.validUntil !== 'string'
  ) {
    return null;
  }
  const validUntil = new Date(subscription.validUntil);
  if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() <= now.getTime()) return null;
  return validUntil.toISOString();
}
