import type { Rote } from '@/types/main';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

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
    emailVerified: false,
  },
  createdAt: '',
  updatedAt: '',
};

const editor_newRoteAtom = atomWithStorage<Rote>('editor_newRoteAtom', emptyRote);
const editor_editRoteAtom = atom<Rote>(emptyRote);

export function useEditor() {
  return { editor_newRoteAtom, editor_editRoteAtom };
}
