import { and, eq } from 'drizzle-orm';
import { rolePermissionPolicies, userPermissionOverrides, users } from '../drizzle/schema';
import { billingGrantRepository } from '../billing/grantRepository';
import { billingConfig } from '../billing/runtimeConfig';
import { UserRole } from '../types/main';
import db from '../utils/drizzle';
import {
  CAPABILITY_KEYS,
  getRoleDefaultCapability,
  isCapabilityEffect,
  isCapabilityKey,
  resolveEffectiveCapabilities,
  type CapabilityEffect,
  type CapabilityKey,
  type CapabilityOverride,
  type EffectiveCapabilities,
} from './capabilities';

function isActiveOverride(expiresAt: Date | null, now = new Date()): boolean {
  return !expiresAt || expiresAt.getTime() > now.getTime();
}

export function resolveCapabilitiesFromRecords(params: {
  role: string;
  rolePolicies: readonly { permission: string; effect: string }[];
  userOverrides: readonly { permission: string; effect: string; expiresAt: Date | null }[];
  billingGrant?: {
    status: unknown;
    capabilities: unknown;
    leaseExpiresAt: Date | null;
  } | null;
  now?: Date;
}): EffectiveCapabilities {
  const now = params.now ?? new Date();
  const rolePolicies = Object.fromEntries(
    params.rolePolicies
      .filter(
        (policy): policy is { permission: CapabilityKey; effect: CapabilityEffect } =>
          isCapabilityKey(policy.permission) && isCapabilityEffect(policy.effect)
      )
      .map((policy) => [policy.permission, policy.effect])
  ) as Partial<Record<CapabilityKey, CapabilityEffect>>;
  const userOverrides = Object.fromEntries(
    params.userOverrides
      .filter(
        (
          override
        ): override is {
          permission: CapabilityKey;
          effect: CapabilityEffect;
          expiresAt: Date | null;
        } =>
          isCapabilityKey(override.permission) &&
          isCapabilityEffect(override.effect) &&
          isActiveOverride(override.expiresAt, now)
      )
      .map((override) => [override.permission, override.effect])
  ) as Partial<Record<CapabilityKey, CapabilityEffect>>;

  return resolveEffectiveCapabilities({
    role: params.role,
    rolePolicies,
    userOverrides,
    ...(params.billingGrant
      ? {
          subscription: {
            status: params.billingGrant.status,
            capabilities: params.billingGrant.capabilities,
            validUntil: params.billingGrant.leaseExpiresAt?.toISOString(),
          },
        }
      : {}),
    now,
  });
}

export async function getEffectiveCapabilitiesForUser(userId: string): Promise<{
  role: string;
  capabilities: EffectiveCapabilities;
}> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error('User not found');

  const [rolePolicies, userOverrides, billingGrant] = await Promise.all([
    db
      .select({
        permission: rolePermissionPolicies.permission,
        effect: rolePermissionPolicies.effect,
      })
      .from(rolePermissionPolicies)
      .where(eq(rolePermissionPolicies.role, user.role)),
    db
      .select({
        permission: userPermissionOverrides.permission,
        effect: userPermissionOverrides.effect,
        expiresAt: userPermissionOverrides.expiresAt,
      })
      .from(userPermissionOverrides)
      .where(eq(userPermissionOverrides.userid, userId)),
    billingConfig.enabled ? billingGrantRepository.findGrantForUser(userId) : Promise.resolve(null),
  ]);

  const capabilities = resolveCapabilitiesFromRecords({
    role: user.role,
    rolePolicies,
    userOverrides,
    billingGrant,
  });

  return { role: user.role, capabilities };
}

export async function hasCapability(userId: string, capability: CapabilityKey): Promise<boolean> {
  const effective = await getEffectiveCapabilitiesForUser(userId);
  return effective.capabilities[capability].allowed;
}

export async function getRoleCapabilityPolicies() {
  const policies = await db
    .select({
      role: rolePermissionPolicies.role,
      permission: rolePermissionPolicies.permission,
      effect: rolePermissionPolicies.effect,
    })
    .from(rolePermissionPolicies);
  const explicit = new Map(
    policies.map((policy) => [`${policy.role}:${policy.permission}`, policy.effect])
  );

  return Object.values(UserRole).map((role) => ({
    role,
    capabilities: Object.fromEntries(
      CAPABILITY_KEYS.map((capability) => {
        const effect = explicit.get(`${role}:${capability}`) as CapabilityEffect | undefined;
        return [
          capability,
          effect || (getRoleDefaultCapability(role, capability) ? 'allow' : 'deny'),
        ];
      })
    ) as Record<CapabilityKey, CapabilityEffect>,
  }));
}

export async function setRoleCapabilityPolicies(
  role: UserRole,
  capabilities: Partial<Record<CapabilityKey, CapabilityEffect>>
) {
  await db.transaction(async (tx) => {
    for (const [permission, effect] of Object.entries(capabilities)) {
      await tx
        .insert(rolePermissionPolicies)
        .values({ role, permission, effect })
        .onConflictDoUpdate({
          target: [rolePermissionPolicies.role, rolePermissionPolicies.permission],
          set: { effect, updatedAt: new Date() },
        });
    }
  });
  return getRoleCapabilityPolicies();
}

export async function getUserCapabilityOverrides(userId: string) {
  const effective = await getEffectiveCapabilitiesForUser(userId);
  const overrides = await db
    .select({
      permission: userPermissionOverrides.permission,
      effect: userPermissionOverrides.effect,
      expiresAt: userPermissionOverrides.expiresAt,
      reason: userPermissionOverrides.reason,
    })
    .from(userPermissionOverrides)
    .where(eq(userPermissionOverrides.userid, userId));

  return {
    ...effective,
    overrides: Object.fromEntries(
      CAPABILITY_KEYS.map((capability) => {
        const override = overrides.find(
          (item) => item.permission === capability && isActiveOverride(item.expiresAt)
        );
        return [capability, override?.effect || 'inherit'];
      })
    ) as Record<CapabilityKey, CapabilityOverride>,
  };
}

export async function setUserCapabilityOverrides(params: {
  userId: string;
  capabilities: Partial<Record<CapabilityKey, CapabilityOverride>>;
  updatedBy: string;
  reason?: string;
}) {
  await db.transaction(async (tx) => {
    for (const [permission, effect] of Object.entries(params.capabilities)) {
      if (effect === 'inherit') {
        await tx
          .delete(userPermissionOverrides)
          .where(
            and(
              eq(userPermissionOverrides.userid, params.userId),
              eq(userPermissionOverrides.permission, permission)
            )
          );
        continue;
      }

      await tx
        .insert(userPermissionOverrides)
        .values({
          userid: params.userId,
          permission,
          effect,
          reason: params.reason || null,
          updatedBy: params.updatedBy,
        })
        .onConflictDoUpdate({
          target: [userPermissionOverrides.userid, userPermissionOverrides.permission],
          set: {
            effect,
            reason: params.reason || null,
            updatedBy: params.updatedBy,
            expiresAt: null,
            updatedAt: new Date(),
          },
        });
    }
  });

  return getUserCapabilityOverrides(params.userId);
}
