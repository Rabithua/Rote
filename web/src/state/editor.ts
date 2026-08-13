import type { Attachment, Rote } from '@/types/main';
import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

export const emptyRote: Rote = {
  content: '',
  tags: [],
  attachments: [],
  pin: false,
  archived: false,
  state: 'private',
  reactions: [],
  article: null,
  articleId: null,
  id: '',
  author: {
    username: '',
    nickname: '',
    avatar: '',
    certified: false,
  },
  createdAt: '',
  updatedAt: '',
};

function isStoredAttachment(value: unknown): value is Attachment {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as Partial<Attachment>).id === 'string' &&
    typeof (value as Partial<Attachment>).url === 'string'
  );
}

export function sanitizeStoredEditorDraft(value: Rote): Rote {
  return {
    ...value,
    // Browser File objects cannot be restored from JSON. Keep them in the
    // current editor session only instead of persisting broken `{}` entries.
    attachments: Array.isArray(value.attachments)
      ? value.attachments.filter(isStoredAttachment)
      : [],
  };
}

const jsonEditorStorage = createJSONStorage<Rote>(() => localStorage);
const editorStorage = {
  getItem: (key: string, initialValue: Rote) =>
    sanitizeStoredEditorDraft(jsonEditorStorage.getItem(key, initialValue)),
  setItem: (key: string, value: Rote) =>
    jsonEditorStorage.setItem(key, sanitizeStoredEditorDraft(value)),
  removeItem: (key: string) => jsonEditorStorage.removeItem(key),
};

const editor_newRoteAtom = atomWithStorage<Rote>('editor_newRoteAtom', emptyRote, editorStorage, {
  getOnInit: true,
});
const editor_editRoteAtom = atom<Rote>(emptyRote);

export function useEditor() {
  return { editor_newRoteAtom, editor_editRoteAtom };
}
