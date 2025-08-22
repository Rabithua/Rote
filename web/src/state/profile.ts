import type { Profile } from '@/types/main';
import { get, put } from '@/utils/api';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { selectAtom } from 'jotai/utils';

// 全局 Profile 状态（初始为 undefined，沿用现有 Profile 类型定义）
export const profileAtom = atom<Profile>(undefined as Profile);

// 加载当前用户 Profile 并写入 atom
export const loadProfileAtom = atom(null, async (_get, set) => {
  const res = await get('/users/me/profile');
  set(profileAtom, res.data as Profile);
});

// 局部更新 Profile（先请求后本地合并）
export const patchProfileAtom = atom(
  null,
  async (get, set, patch: Partial<NonNullable<Profile>>) => {
    await put('/users/me/profile', patch as any);
    const cur = get(profileAtom);
    if (cur) set(profileAtom, { ...cur, ...patch } as Profile);
  }
);

// 字段级选择器：组件只订阅自身关心的字段，减少不必要渲染
export const selectProfile = <T>(
  selector: (_p: Profile) => T,
  equalityFn: (_a: T, _b: T) => boolean = Object.is
) => selectAtom(profileAtom, selector, equalityFn);

// 便捷 hooks（可选）
export const useProfile = () => useAtomValue(profileAtom);
export const useSetProfile = () => useSetAtom(profileAtom);
