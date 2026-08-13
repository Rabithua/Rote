import type { ResourceState } from './types';

export type ResourcePreviewScenario = 'free' | 'pro' | 'expired';

export const RESOURCE_PREVIEW_SCENARIOS: ResourcePreviewScenario[] = ['free', 'pro', 'expired'];

export const RESOURCE_PREVIEW_STATES: Record<ResourcePreviewScenario, ResourceState> = {
  free: {
    management: 'official',
    source: 'official_free',
    storage: {
      enforcement: 'enforce',
      usedBytes: '128000000',
      reservedBytes: '12000000',
      limitBytes: '500000000',
      overLimit: false,
      canUpload: true,
    },
    openKey: {
      policy: 'threshold',
      creationThreshold: 1,
      existingCount: 0,
      canCreate: true,
    },
  },
  pro: {
    management: 'official',
    source: 'official_pro',
    storage: {
      enforcement: 'enforce',
      usedBytes: '2400000000',
      reservedBytes: '80000000',
      limitBytes: '10600000000',
      overLimit: false,
      canUpload: true,
    },
    openKey: {
      policy: 'unlimited',
      creationThreshold: null,
      existingCount: 6,
      canCreate: true,
    },
  },
  expired: {
    management: 'official',
    source: 'official_free',
    storage: {
      enforcement: 'enforce',
      usedBytes: '2400000000',
      reservedBytes: '0',
      limitBytes: '500000000',
      overLimit: true,
      canUpload: false,
    },
    openKey: {
      policy: 'threshold',
      creationThreshold: 1,
      existingCount: 6,
      canCreate: false,
    },
  },
};

export function parseResourcePreviewScenario(value: string | null) {
  return RESOURCE_PREVIEW_SCENARIOS.find((scenario) => scenario === value) ?? null;
}
