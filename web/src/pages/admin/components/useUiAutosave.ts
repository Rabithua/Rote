import { put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import isEqual from 'lodash/isEqual';
import { useEffect, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import type { SystemConfig } from '../types';

type UiConfig = NonNullable<SystemConfig['ui']>;
export type UiField =
  | 'allowRegistration'
  | 'allowUploadFile'
  | 'defaultUserRole'
  | 'apiRateLimit'
  | 'maxVideoUploadSizeMB';
export type AutosaveField = UiField | 'requireCertifiedUserForExplore';
export type AutosaveStatus = { state: 'saving' | 'saved' | 'error'; error?: string };
export type UiSettingsUpdate = {
  ui?: SystemConfig['ui'];
  requireCertifiedUserForExplore?: boolean;
};
interface UiAutosaveOptions {
  uiConfig: SystemConfig['ui'];
  securityConfig: SystemConfig['security'];
  onMutate: () => unknown;
  onSaved?: (update: UiSettingsUpdate) => void;
}
type SaveOperation = {
  field: AutosaveField;
  value: UiConfig[UiField] | boolean;
  resolve: (success: boolean) => void;
};
function normalizedUi(config: SystemConfig['ui']): UiConfig {
  return {
    allowRegistration: true,
    allowUploadFile: true,
    defaultUserRole: 'user',
    apiRateLimit: 100,
    maxVideoUploadSizeMB: 300,
    ...config,
  };
}
function securityPolicy(config: SystemConfig['security']) {
  return config?.requireCertifiedUserForExplore ?? config?.requireVerifiedEmailForExplore ?? false;
}
export function useUiAutosave(options: UiAutosaveOptions) {
  const { mutate } = useSWRConfig();
  const [ui, setUi] = useState(() => normalizedUi(options.uiConfig));
  const [policy, setPolicy] = useState(() => securityPolicy(options.securityConfig));
  const [statuses, setStatuses] = useState<Partial<Record<AutosaveField, AutosaveStatus>>>({});
  const confirmedUi = useRef(ui);
  const confirmedPolicy = useRef(policy);
  const source = useRef({ ui: options.uiConfig, policy: securityPolicy(options.securityConfig) });
  const queue = useRef<SaveOperation[]>([]);
  const active = useRef(false);
  const inFlightGroup = useRef<'ui' | 'security' | null>(null);
  const pendingUiSource = useRef<UiConfig | null>(null);
  const pendingPolicySource = useRef<boolean | null>(null);
  const failed = useRef<Partial<Record<AutosaveField, SaveOperation>>>({});
  const callbacks = useRef(options);
  callbacks.current = options;

  const visibleUi = (confirmed: UiConfig) => {
    let next = confirmed;
    for (const operation of queue.current) {
      if (
        operation.field !== 'requireCertifiedUserForExplore' &&
        operation.field !== 'apiRateLimit' &&
        operation.field !== 'maxVideoUploadSizeMB'
      ) {
        next = { ...next, [operation.field]: operation.value };
      }
    }
    return next;
  };
  const visiblePolicy = (confirmed: boolean) => {
    let next = confirmed;
    for (const operation of queue.current) {
      if (operation.field === 'requireCertifiedUserForExplore') next = operation.value as boolean;
    }
    return next;
  };

  useEffect(() => {
    const nextPolicy = securityPolicy(options.securityConfig);
    if (!isEqual(source.current.ui, options.uiConfig)) {
      source.current.ui = options.uiConfig;
      const incoming = normalizedUi(options.uiConfig);
      if (inFlightGroup.current === 'ui') pendingUiSource.current = incoming;
      else {
        confirmedUi.current = incoming;
        setUi(visibleUi(incoming));
      }
    }
    if (source.current.policy !== nextPolicy) {
      source.current.policy = nextPolicy;
      if (inFlightGroup.current === 'security') pendingPolicySource.current = nextPolicy;
      else {
        confirmedPolicy.current = nextPolicy;
        setPolicy(visiblePolicy(nextPolicy));
      }
    }
  }, [options.uiConfig, options.securityConfig]);
  const drain = async () => {
    if (active.current) return;
    active.current = true;
    let didSave = false;
    while (queue.current.length) {
      const operation = queue.current.shift()!;
      const { field, value } = operation;
      inFlightGroup.current = field === 'requireCertifiedUserForExplore' ? 'security' : 'ui';
      let success = false;
      try {
        if (field === 'requireCertifiedUserForExplore') {
          const config = { requireCertifiedUserForExplore: value as boolean };
          await put('/admin/settings', { group: 'security', config });
          confirmedPolicy.current = config.requireCertifiedUserForExplore;
          pendingPolicySource.current = null;
          setPolicy(visiblePolicy(confirmedPolicy.current));
          callbacks.current.onSaved?.(config);
        } else {
          // Only acknowledged values join this field in a complete UI snapshot.
          const config = { ...confirmedUi.current, [field]: value };
          await put('/admin/settings', { group: 'ui', config });
          confirmedUi.current = config;
          pendingUiSource.current = null;
          setUi(visibleUi(config));
          callbacks.current.onSaved?.({ ui: config });
        }
        delete failed.current[field];
        setStatuses((current) => ({ ...current, [field]: { state: 'saved' } }));
        success = true;
        didSave = true;
      } catch (error) {
        failed.current[field] = operation;
        if (field === 'requireCertifiedUserForExplore') {
          confirmedPolicy.current = pendingPolicySource.current ?? confirmedPolicy.current;
          pendingPolicySource.current = null;
          setPolicy(visiblePolicy(confirmedPolicy.current));
        } else {
          confirmedUi.current = pendingUiSource.current ?? confirmedUi.current;
          pendingUiSource.current = null;
          setUi(visibleUi(confirmedUi.current));
        }
        setStatuses((current) => ({
          ...current,
          [field]: { state: 'error', error: getErrorMessage(error) },
        }));
      }
      inFlightGroup.current = null;
      operation.resolve(success);
    }
    active.current = false;
    // Refreshing caches does not extend the pending-write navigation guard.
    if (didSave) {
      void Promise.allSettled([
        Promise.resolve(callbacks.current.onMutate()),
        mutate('site-status'),
      ]);
    }
  };
  const enqueue = (field: AutosaveField, value: SaveOperation['value']): Promise<boolean> => {
    if (field === 'requireCertifiedUserForExplore') setPolicy(value as boolean);
    else if (field !== 'apiRateLimit' && field !== 'maxVideoUploadSizeMB') {
      setUi((current) => ({ ...current, [field]: value }));
    }
    setStatuses((current) => ({ ...current, [field]: { state: 'saving' } }));
    return new Promise((resolve) => {
      queue.current.push({ field, value, resolve });
      void drain();
    });
  };
  return {
    ui,
    policy,
    statuses,
    isSaving: Object.values(statuses).some((status) => status.state === 'saving'),
    saveUi: <K extends UiField>(field: K, value: UiConfig[K]) => enqueue(field, value),
    savePolicy: (value: boolean) => enqueue('requireCertifiedUserForExplore', value),
    retry: (field: AutosaveField) => {
      const operation = failed.current[field];
      if (operation) void enqueue(operation.field, operation.value);
    },
  };
}
