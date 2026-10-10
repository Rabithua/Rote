import { atomWithStorage } from 'jotai/utils';
import type { ReasoningEffort } from '@/utils/chatParameters';

export type PersonalAiMode = 'site' | 'personal';

export interface PersonalAiProviderConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  reasoningEffort?: ReasoningEffort | null;
}

export interface PersonalAiSettings {
  mode: PersonalAiMode;
  personal: PersonalAiProviderConfig;
  local?: PersonalAiProviderConfig;
  remote?: PersonalAiProviderConfig;
}

type LegacyPersonalAiSettings = Omit<Partial<PersonalAiSettings>, 'mode'> & {
  mode?: PersonalAiMode | 'local' | 'remote';
};

export const DEFAULT_PERSONAL_AI_SETTINGS: PersonalAiSettings = {
  mode: 'site',
  personal: {
    enabled: false,
    baseUrl: 'http://127.0.0.1:8080/v1',
    model: 'gemma-4-12b-it',
    apiKey: '',
    temperature: 0.2,
    reasoningEffort: 'high',
  },
};

const DEFAULT_LEGACY_REMOTE_PROVIDER: PersonalAiProviderConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  apiKey: '',
  temperature: 0.2,
  reasoningEffort: 'high',
};

export function isLocalPersonalAiProvider(config: Pick<PersonalAiProviderConfig, 'baseUrl'>) {
  try {
    const url = new URL(config.baseUrl.trim());
    return ['127.0.0.1', 'localhost', '0.0.0.0', '[::1]', '::1'].includes(url.hostname);
  } catch {
    return /(^https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|::1)(:|\/|$)/i.test(
      config.baseUrl.trim()
    );
  }
}

function chooseProviderConfig(settings: LegacyPersonalAiSettings | null | undefined) {
  const personal = settings?.personal;
  const local = settings?.local;
  const remote = settings?.remote;

  if (personal) return personal;
  if (settings?.mode === 'remote' && remote) return remote;
  if (settings?.mode === 'local' && local) return local;
  if (
    remote?.enabled ||
    (remote?.baseUrl && remote.baseUrl !== DEFAULT_LEGACY_REMOTE_PROVIDER.baseUrl)
  ) {
    return remote;
  }
  return local || DEFAULT_PERSONAL_AI_SETTINGS.personal;
}

export function withPersonalAiDefaults(
  settings: LegacyPersonalAiSettings | null | undefined
): PersonalAiSettings {
  const mode: PersonalAiMode =
    settings?.mode === 'personal' || settings?.mode === 'local' || settings?.mode === 'remote'
      ? 'personal'
      : 'site';
  const provider = chooseProviderConfig(settings);
  const local = settings?.local
    ? {
        ...DEFAULT_PERSONAL_AI_SETTINGS.personal,
        ...settings.local,
      }
    : undefined;
  const remote = settings?.remote
    ? {
        ...DEFAULT_LEGACY_REMOTE_PROVIDER,
        ...settings.remote,
      }
    : undefined;

  return {
    ...DEFAULT_PERSONAL_AI_SETTINGS,
    ...settings,
    mode,
    personal: {
      ...DEFAULT_PERSONAL_AI_SETTINGS.personal,
      ...provider,
    },
    local,
    remote,
  };
}

export const personalAiSettingsAtom = atomWithStorage<PersonalAiSettings>(
  'personalAiSettings',
  DEFAULT_PERSONAL_AI_SETTINGS
);
