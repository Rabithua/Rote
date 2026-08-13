export type ResourceManagement = 'unmanaged' | 'official';
export type ResourceSource = 'unmanaged' | 'official_free' | 'official_pro' | 'role_exempt';

export interface ResourceState {
  management: ResourceManagement;
  source: ResourceSource;
  storage: {
    enforcement: 'off' | 'observe' | 'enforce';
    usedBytes: string | null;
    reservedBytes: string | null;
    limitBytes: string | null;
    overLimit: boolean | null;
    canUpload: boolean;
  };
  openKey: {
    policy: 'unmanaged' | 'threshold' | 'unlimited';
    creationThreshold: number | null;
    existingCount: number;
    canCreate: boolean;
  };
}
