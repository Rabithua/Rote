export const CAPABILITY_KEYS = [
  'attachment.upload',
  'attachment.video.upload',
  'ai.chat',
  'resource.storage.unlimited',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];
export type CapabilityEffect = 'allow' | 'deny';
export type CapabilityOverride = CapabilityEffect | 'inherit';

export type EffectiveCapability = {
  allowed: boolean;
  source: 'user_override' | 'subscription' | 'role_policy' | 'role_default' | 'dependency';
  role: string;
  validUntil?: string;
};

export type EffectiveCapabilities = Record<CapabilityKey, EffectiveCapability>;

export const MANAGEABLE_ROLES = ['user', 'moderator', 'admin'] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export type RoleCapabilityPolicy = {
  role: string;
  capabilities: Record<CapabilityKey, CapabilityOverride>;
  effective: EffectiveCapabilities;
};

export type EffectivePermissionsResponse = {
  role: string;
  capabilities: EffectiveCapabilities;
};

export type UserCapabilityPermissions = EffectivePermissionsResponse & {
  overrides: Record<CapabilityKey, CapabilityOverride>;
};
