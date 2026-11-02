import type {
  CapabilityKey,
  CapabilityOverride,
  ManageableRole,
  RoleCapabilityPolicy,
} from '@/types/permissions';
import { MANAGEABLE_ROLES } from '@/types/permissions';
import isEqual from 'lodash/isEqual';
import { useState } from 'react';

type RoleCapabilities = Record<CapabilityKey, CapabilityOverride>;
type RoleDrafts = Partial<Record<ManageableRole, RoleCapabilities>>;

function getRoleCapabilities(policies: RoleCapabilityPolicy[] | undefined): RoleDrafts {
  return Object.fromEntries(
    (policies || [])
      .filter((policy) => MANAGEABLE_ROLES.includes(policy.role as ManageableRole))
      .map((policy) => [policy.role, policy.capabilities])
  ) as RoleDrafts;
}

export function usePermissionsDrafts(policies: RoleCapabilityPolicy[] | undefined) {
  const [state, setState] = useState(() => {
    const baseline = getRoleCapabilities(policies);
    return { source: policies, baseline, drafts: baseline };
  });

  if (policies && policies !== state.source) {
    const baseline = getRoleCapabilities(policies);
    const drafts = { ...baseline };
    for (const role of MANAGEABLE_ROLES) {
      if (!isEqual(state.drafts[role], state.baseline[role])) {
        drafts[role] = state.drafts[role];
      }
    }
    setState({ source: policies, baseline, drafts });
  }

  const updateRoleCapability = (
    role: ManageableRole,
    capability: CapabilityKey,
    effect: CapabilityOverride
  ) => {
    setState((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [role]: { ...current.drafts[role], [capability]: effect } as RoleCapabilities,
      },
    }));
  };

  const markRoleSaved = (role: ManageableRole, capabilities: RoleCapabilities) => {
    setState((current) => ({
      ...current,
      baseline: { ...current.baseline, [role]: capabilities },
    }));
  };

  const dirtyRoles = MANAGEABLE_ROLES.filter(
    (role) => !isEqual(state.drafts[role], state.baseline[role])
  );

  return {
    drafts: state.drafts,
    dirtyRoles,
    hasUnsavedChanges: dirtyRoles.length > 0,
    markRoleSaved,
    updateRoleCapability,
  };
}
