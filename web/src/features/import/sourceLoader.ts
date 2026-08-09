import { importMessage } from './messages';
import type { FetchProgress } from './converters/memos-api';
import type { ConversionResult, MemoSourceData, SQLiteSourceData, User } from './converters/types';

export type ImportSource = 'rote' | 'memos' | 'flomo' | 'weread';
export type ImportMode = 'file' | 'api';

export interface ImportPayload extends Record<string, unknown> {
  notes: Array<unknown>;
  articles?: Array<unknown>;
}

interface PrepareImportInput {
  source: ImportSource;
  mode: ImportMode;
  file?: File;
  memosBaseUrl?: string;
  memosToken?: string;
  wereadApiKey?: string;
  selectedMemosUserId?: number;
  parsedMemosData?: SQLiteSourceData;
  onProgress?: (progress: FetchProgress) => void;
}

export interface ReadyImport {
  kind: 'ready';
  payload: ImportPayload;
  displayName: string;
  warnings: Array<string>;
  migrationAuth?: ImportMigrationAuth;
}

export type ImportMigrationAuth = {
  provider: 'memos';
  baseUrl: string;
  token: string;
};

export interface MemosUserSelection {
  kind: 'select-memos-user';
  data: SQLiteSourceData;
  displayName: string;
  users: Array<User>;
}

export type PreparedImport = ReadyImport | MemosUserSelection;

export async function prepareImport(input: PrepareImportInput): Promise<PreparedImport> {
  if (input.source === 'rote') return prepareRoteFile(input.file);
  if (input.source === 'memos') return prepareMemos(input);
  if (input.source === 'flomo') return prepareFlomo(input.file);
  return prepareWeread(input);
}

async function prepareRoteFile(file?: File): Promise<ReadyImport> {
  const selectedFile = requireFile(file);
  const { readJSONFile } = await import('./files');
  const data = await readJSONFile(selectedFile);

  if (!isImportPayload(data)) {
    throw new Error(importMessage('errors.invalidRoteFile'));
  }

  return {
    kind: 'ready',
    payload: data,
    displayName: selectedFile.name,
    warnings: [],
  };
}

async function prepareMemos(input: PrepareImportInput): Promise<PreparedImport> {
  const [{ convertMemosToRote }, sourceData] = await Promise.all([
    import('./converters/memos-to-rote'),
    loadMemosSource(input),
  ]);

  const displayName =
    input.mode === 'api'
      ? importMessage('labels.memosApi')
      : (input.file?.name ?? importMessage('sources.memos'));

  if ('users' in sourceData) {
    const usersWithMemos = sourceData.users.filter((user) =>
      sourceData.memos.some((memo) => memo.creator_id === user.id)
    );
    if (usersWithMemos.length > 1 && input.selectedMemosUserId === undefined) {
      return {
        kind: 'select-memos-user',
        data: sourceData,
        displayName,
        users: usersWithMemos,
      };
    }
  }

  const ready = conversionReady(
    convertMemosToRote(sourceData, input.selectedMemosUserId, {
      preserveVisibility: true,
    }),
    displayName
  );
  if (input.mode === 'api' && input.memosBaseUrl && input.memosToken) {
    ready.migrationAuth = {
      provider: 'memos',
      baseUrl: input.memosBaseUrl.trim().replace(/\/+$/u, ''),
      token: input.memosToken.trim(),
    };
  }
  return ready;
}

async function loadMemosSource(
  input: PrepareImportInput
): Promise<MemoSourceData | SQLiteSourceData> {
  if (input.parsedMemosData) return input.parsedMemosData;

  if (input.mode === 'api') {
    const baseUrl = input.memosBaseUrl?.trim();
    const token = input.memosToken?.trim();
    if (!baseUrl || !token) {
      throw new Error(importMessage('errors.memosCredentialsRequired'));
    }

    const { fetchMemosFromApi } = await import('./converters/memos-api');
    return fetchMemosFromApi({ baseUrl, token }, input.onProgress);
  }

  const file = requireFile(input.file);
  const fileName = file.name.toLowerCase();
  const { readJSONFile, readSQLiteFile } = await import('./files');
  if (fileName.endsWith('.db') || fileName.endsWith('.sqlite') || fileName.endsWith('.sqlite3')) {
    return (await readSQLiteFile(file)) as SQLiteSourceData;
  }
  if (fileName.endsWith('.json')) {
    return (await readJSONFile(file)) as MemoSourceData;
  }

  throw new Error(importMessage('errors.unsupportedMemosFile'));
}

async function prepareFlomo(file?: File): Promise<ReadyImport> {
  const selectedFile = requireFile(file);
  const [{ readFlomoFile }, { convertFlomoToRote }] = await Promise.all([
    import('./files'),
    import('./converters/flomo-to-rote'),
  ]);
  const sourceData = await readFlomoFile(selectedFile);

  return conversionReady(
    convertFlomoToRote(sourceData, undefined, { preserveVisibility: true }),
    selectedFile.name
  );
}

async function prepareWeread(input: PrepareImportInput): Promise<ReadyImport> {
  const converterPromise = import('./converters/weread-to-rote');
  let sourceData: unknown;
  let displayName: string;

  if (input.mode === 'api') {
    const apiKey = input.wereadApiKey?.trim();
    if (!apiKey) {
      throw new Error(importMessage('errors.wereadKeyRequired'));
    }
    const { fetchWereadFromApi } = await import('./converters/weread-api');
    sourceData = await fetchWereadFromApi(apiKey, input.onProgress);
    displayName = importMessage('labels.wereadApi');
  } else {
    const file = requireFile(input.file);
    const { readWereadFile } = await import('./files');
    sourceData = await readWereadFile(file);
    displayName = file.name;
  }

  const { convertWereadToRote } = await converterPromise;

  return conversionReady(
    convertWereadToRote(sourceData, undefined, {
      preserveVisibility: true,
    }),
    displayName
  );
}

function conversionReady(result: ConversionResult, displayName: string): ReadyImport {
  if (!result.data || result.data.notes.length === 0) {
    throw new Error(result.errors.join('\n') || importMessage('errors.noConvertedNotes'));
  }

  return {
    kind: 'ready',
    payload: result.data as unknown as ImportPayload,
    displayName,
    warnings: [...result.warnings, ...result.errors],
  };
}

function requireFile(file?: File): File {
  if (!file) throw new Error(importMessage('errors.fileRequired'));
  return file;
}

function isImportPayload(value: unknown): value is ImportPayload {
  return (
    !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).notes)
  );
}
