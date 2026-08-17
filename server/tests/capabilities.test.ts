import { describe, expect, it } from 'bun:test';
import { UserRole } from '../types/main';
import { buildRoleCapabilitySettings, resolveEffectiveCapabilities } from '../authz/capabilities';

describe('capability resolution', () => {
  it('keeps AI chat denied for users and allowed for admins by default', () => {
    const userCapabilities = resolveEffectiveCapabilities({ role: UserRole.USER });
    const moderatorCapabilities = resolveEffectiveCapabilities({ role: UserRole.MODERATOR });
    const adminCapabilities = resolveEffectiveCapabilities({ role: UserRole.ADMIN });

    expect(userCapabilities['ai.chat'].allowed).toBe(false);
    expect(moderatorCapabilities['ai.chat'].allowed).toBe(false);
    expect(adminCapabilities['ai.chat'].allowed).toBe(true);
  });

  it('denies unlimited storage for users and moderators but allows it for admins by default', () => {
    expect(
      resolveEffectiveCapabilities({ role: UserRole.USER })['resource.storage.unlimited']
    ).toEqual({ allowed: false, source: 'role_default', role: UserRole.USER });
    expect(
      resolveEffectiveCapabilities({ role: UserRole.MODERATOR })['resource.storage.unlimited']
    ).toEqual({ allowed: false, source: 'role_default', role: UserRole.MODERATOR });
    expect(
      resolveEffectiveCapabilities({ role: UserRole.ADMIN })['resource.storage.unlimited']
    ).toEqual({ allowed: true, source: 'role_default', role: UserRole.ADMIN });
  });

  it('preserves inherit for missing role policies while reporting the effective default', () => {
    const settings = buildRoleCapabilitySettings([
      {
        role: UserRole.USER,
        permission: 'resource.storage.unlimited',
        effect: 'allow',
      },
    ]);
    const user = settings.find((setting) => setting.role === UserRole.USER)!;
    const moderator = settings.find((setting) => setting.role === UserRole.MODERATOR)!;
    const admin = settings.find((setting) => setting.role === UserRole.ADMIN)!;

    expect(user.capabilities['resource.storage.unlimited']).toBe('allow');
    expect(user.effective['resource.storage.unlimited']).toMatchObject({
      allowed: true,
      source: 'role_policy',
    });
    expect(moderator.capabilities['resource.storage.unlimited']).toBe('inherit');
    expect(moderator.effective['resource.storage.unlimited']).toMatchObject({
      allowed: false,
      source: 'role_default',
    });
    expect(admin.capabilities['resource.storage.unlimited']).toBe('inherit');
    expect(admin.effective['resource.storage.unlimited']).toMatchObject({
      allowed: true,
      source: 'role_default',
    });
  });

  it('applies unlimited storage role policies and user overrides in priority order', () => {
    const roleAllowed = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: { 'resource.storage.unlimited': 'allow' },
    });
    const userDenied = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: { 'resource.storage.unlimited': 'allow' },
      userOverrides: { 'resource.storage.unlimited': 'deny' },
    });
    const userAllowed = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: { 'resource.storage.unlimited': 'deny' },
      userOverrides: { 'resource.storage.unlimited': 'allow' },
    });

    expect(roleAllowed['resource.storage.unlimited'].source).toBe('role_policy');
    expect(roleAllowed['resource.storage.unlimited'].allowed).toBe(true);
    expect(userDenied['resource.storage.unlimited'].source).toBe('user_override');
    expect(userDenied['resource.storage.unlimited'].allowed).toBe(false);
    expect(userAllowed['resource.storage.unlimited'].source).toBe('user_override');
    expect(userAllowed['resource.storage.unlimited'].allowed).toBe(true);
  });

  it('does not include unlimited storage in an ordinary Pro capability grant', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      subscription: {
        status: 'active',
        capabilities: ['attachment.video.upload', 'ai.chat'],
        validUntil: '2026-08-08T00:00:00.000Z',
      },
      now: new Date('2026-08-07T00:00:00.000Z'),
    });

    expect(capabilities['resource.storage.unlimited']).toEqual({
      allowed: false,
      source: 'role_default',
      role: UserRole.USER,
    });
  });

  it('does not grant unrelated capabilities with unlimited storage', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: {
        'attachment.upload': 'deny',
        'resource.storage.unlimited': 'allow',
      },
    });

    expect(capabilities['resource.storage.unlimited'].allowed).toBe(true);
    expect(capabilities['attachment.upload'].allowed).toBe(false);
    expect(capabilities['attachment.video.upload'].allowed).toBe(false);
    expect(capabilities['ai.chat'].allowed).toBe(false);
  });

  it('uses user overrides before role policies', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: { 'ai.chat': 'deny' },
      userOverrides: { 'ai.chat': 'allow' },
    });

    expect(capabilities['ai.chat']).toEqual({
      allowed: true,
      source: 'user_override',
      role: UserRole.USER,
    });
  });

  it('denies video upload when attachment upload is denied', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      userOverrides: {
        'attachment.upload': 'deny',
        'attachment.video.upload': 'allow',
      },
    });

    expect(capabilities['attachment.video.upload']).toEqual({
      allowed: false,
      source: 'dependency',
      role: UserRole.USER,
    });
  });

  it('does not allow policies or overrides to reduce super admin permissions', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.SUPER_ADMIN,
      rolePolicies: { 'ai.chat': 'deny', 'resource.storage.unlimited': 'deny' },
      userOverrides: {
        'attachment.upload': 'deny',
        'resource.storage.unlimited': 'deny',
      },
    });

    expect(Object.values(capabilities).every((capability) => capability.allowed)).toBe(true);
  });

  it('uses a valid subscription before role policy and includes its lease', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: { 'ai.chat': 'deny' },
      subscription: {
        status: 'active',
        capabilities: ['ai.chat'],
        validUntil: '2026-08-08T00:00:00.000Z',
      },
      now: new Date('2026-08-07T00:00:00.000Z'),
    });

    expect(capabilities['ai.chat']).toEqual({
      allowed: true,
      source: 'subscription',
      role: UserRole.USER,
      validUntil: '2026-08-08T00:00:00.000Z',
    });
  });

  it('keeps user override deny above subscription and dependency above video subscription', () => {
    const subscription = {
      status: 'grace_period',
      capabilities: ['ai.chat', 'attachment.video.upload'],
      validUntil: '2026-08-08T00:00:00.000Z',
    };
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      userOverrides: { 'ai.chat': 'deny', 'attachment.upload': 'deny' },
      subscription,
      now: new Date('2026-08-07T00:00:00.000Z'),
    });

    expect(capabilities['ai.chat']).toEqual({
      allowed: false,
      source: 'user_override',
      role: UserRole.USER,
    });
    expect(capabilities['attachment.video.upload']).toEqual({
      allowed: false,
      source: 'dependency',
      role: UserRole.USER,
    });
  });

  it('fails closed for missing, invalid, or expired subscription leases', () => {
    for (const validUntil of [undefined, 'invalid', '2026-08-07T00:00:00.000Z']) {
      const capabilities = resolveEffectiveCapabilities({
        role: UserRole.USER,
        subscription: {
          status: 'active',
          capabilities: ['ai.chat'],
          validUntil,
        },
        now: new Date('2026-08-07T00:00:00.000Z'),
      });
      expect(capabilities['ai.chat']).toEqual({
        allowed: false,
        source: 'role_default',
        role: UserRole.USER,
      });
    }
  });

  it('keeps non-subscription permission DTO fields backward-compatible', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.ADMIN,
      userOverrides: { 'ai.chat': 'allow' },
    });
    const permissionsMeData = JSON.parse(JSON.stringify({ role: UserRole.ADMIN, capabilities }));

    expect(permissionsMeData.capabilities['ai.chat']).toEqual({
      allowed: true,
      source: 'user_override',
      role: UserRole.ADMIN,
    });
    expect('validUntil' in permissionsMeData.capabilities['ai.chat']).toBe(false);
  });
});
