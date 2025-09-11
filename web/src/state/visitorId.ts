import { atom } from 'jotai';

/**
 * 访客ID状态管理
 * 只用于组件间共享状态，持久化由 deviceFingerprint.ts 处理
 */
export const visitorIdAtom = atom<string | null>(null);
