import { get } from '@/utils/api';
import { atom, useAtomValue, useSetAtom } from 'jotai';

// 全局 Tags 状态：null 表示未加载，[] 表示已加载但为空
export const tagsAtom = atom<string[] | null>(null);

// 加载标签列表
export const loadTagsAtom = atom(null, async (_get, set) => {
  const res = await get('/users/me/tags');
  set(tagsAtom, res.data as string[]);
});

// 便捷 hooks（可选）
export const useTags = () => useAtomValue(tagsAtom);
export const useLoadTags = () => useSetAtom(loadTagsAtom);
