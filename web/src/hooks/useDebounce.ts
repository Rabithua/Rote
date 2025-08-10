import { useCallback, useRef } from 'react';

/**
 * 防抖 Hook - 延迟执行函数调用，避免频繁操作
 * @param callback 要执行的回调函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function useDebounce<T extends (..._args: any[]) => any>(
  callback: T,
  delay: number
): (..._args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * 节流 Hook - 限制函数执行频率
 * @param callback 要执行的回调函数
 * @param delay 节流间隔（毫秒）
 * @returns 节流后的函数
 */
export function useThrottle<T extends (..._args: any[]) => any>(
  callback: T,
  delay: number
): (..._args: Parameters<T>) => void {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRunRef.current >= delay) {
        // 立即执行
        lastRunRef.current = now;
        callback(...args);
      } else {
        // 延迟执行最后一次调用
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(
          () => {
            lastRunRef.current = Date.now();
            callback(...args);
          },
          delay - (now - lastRunRef.current)
        );
      }
    },
    [callback, delay]
  );
}
