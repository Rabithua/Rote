import { useSaveScrollPosition } from '@/hooks/useSaveScrollPosition';

/**
 * 全局滚动位置管理组件
 * 在全局层面统一管理所有页面的滚动位置
 * 不需要保存滚动位置的页面会在 useSaveScrollPosition 中被排除
 */
function ScrollPositionManager() {
  useSaveScrollPosition();
  return null;
}

export default ScrollPositionManager;
