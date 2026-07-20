import { importMessage } from './messages';
import type { SQLiteAttachment, SQLiteMemo, SQLiteSourceData, User } from './converters/types';

export function downloadJSON(data: any, filename: string) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export function readJSONFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        resolve(json);
      } catch {
        reject(new Error(importMessage('errors.parseJson')));
      }
    };

    reader.onerror = () => reject(new Error(importMessage('errors.readFile')));
    reader.readAsText(file);
  });
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };

    reader.onerror = () => reject(new Error(importMessage('errors.readFile')));
    reader.readAsText(file);
  });
}

export async function readFlomoFile(file: File): Promise<{
  html: string;
  filename: string;
}> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return {
      html: await readTextFile(file),
      filename: file.name,
    };
  }

  if (!fileName.endsWith('.zip')) {
    throw new Error(importMessage('errors.unsupportedFlomoFile'));
  }

  const { default: JSZip } = await import('jszip');
  const buffer = await readArrayBufferFile(file);
  const zip = await JSZip.loadAsync(buffer);
  const htmlEntry = Object.values(zip.files).find((entry) => {
    const entryName = entry.name.toLowerCase();
    return !entry.dir && (entryName.endsWith('.html') || entryName.endsWith('.htm'));
  });

  if (!htmlEntry) {
    throw new Error(importMessage('errors.noFlomoHtml'));
  }

  return {
    html: await htmlEntry.async('string'),
    filename: htmlEntry.name,
  };
}

export async function readWereadFile(file: File): Promise<unknown> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.json')) return readJSONFile(file);
  if (fileName.endsWith('.txt')) {
    return { text: await readTextFile(file), filename: file.name };
  }

  throw new Error(importMessage('errors.unsupportedWereadFile'));
}

function readArrayBufferFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target?.result as ArrayBuffer);
    };

    reader.onerror = () => reject(new Error(importMessage('errors.readFile')));
    reader.readAsArrayBuffer(file);
  });
}

export async function readSQLiteFile(file: File): Promise<SQLiteSourceData> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
  ]);
  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const db = new SQL.Database(new Uint8Array(buffer));

        // 读取所有用户
        let users: Array<User> = [];
        try {
          const usersResult = db.exec('SELECT * FROM user');
          users =
            usersResult[0]?.values?.map(
              (row) =>
                ({
                  id: row[0],
                  created_ts: row[1],
                  updated_ts: row[2],
                  row_status: row[3],
                  username: row[4],
                  role: row[5],
                  email: row[6],
                  nickname: row[7],
                  avatar_url: row[9],
                  description: row[10],
                }) as unknown as User
            ) || [];
        } catch {
          users = [];
        }

        // 读取所有 memos
        let memos: Array<SQLiteMemo> = [];
        try {
          const memosResult = db.exec('SELECT * FROM memo');
          memos =
            memosResult[0]?.values?.map(
              (row) =>
                ({
                  id: row[0],
                  uid: row[1],
                  creator_id: row[2],
                  created_ts: row[3],
                  updated_ts: row[4],
                  row_status: row[5],
                  content: row[6],
                  visibility: row[7],
                  pinned: row[8] === 1,
                  payload: JSON.parse(String(row[9] || '{}')),
                }) as unknown as SQLiteMemo
            ) || [];
        } catch {
          memos = [];
        }

        // 读取所有附件
        let attachments: Array<SQLiteAttachment> = [];
        try {
          const attachmentsResult = db.exec('SELECT * FROM attachment');
          attachments =
            attachmentsResult[0]?.values?.map(
              (row) =>
                ({
                  id: row[0],
                  uid: row[1],
                  creator_id: row[2],
                  created_ts: row[3],
                  updated_ts: row[4],
                  filename: row[5],
                  blob: row[6],
                  type: row[7],
                  size: row[8],
                  memo_id: row[9],
                  storage_type: row[10],
                  reference: row[11],
                  payload: JSON.parse(String(row[12] || '{}')),
                }) as unknown as SQLiteAttachment
            ) || [];
        } catch {
          attachments = [];
        }

        db.close();
        resolve({ users, memos, attachments });
      } catch (error) {
        reject(
          new Error(
            importMessage('errors.parseSqlite', {
              error: (error as Error).message,
            })
          )
        );
      }
    };

    reader.onerror = () => reject(new Error(importMessage('errors.readFile')));
    reader.readAsArrayBuffer(file);
  });
}
