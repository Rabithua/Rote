import { useEffect, useState } from 'react';

interface UseTypewriterOptions {
  texts: string[];
  typingSpeed?: number; // 打字速度（毫秒）
  deletingSpeed?: number; // 删除速度（毫秒）
  pauseTime?: number; // 显示完整文本后的暂停时间（毫秒）
}

export function useTypewriter({
  texts,
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseTime = 2000,
}: UseTypewriterOptions) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (texts.length === 0) return;

    const currentText = texts[currentIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      // 打字阶段
      if (charIndex < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, typingSpeed);
      } else {
        // 打字完成，等待后开始删除
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseTime);
      }
    } else {
      // 删除阶段
      if (charIndex > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, deletingSpeed);
      } else {
        // 删除完成，切换到下一个文本
        timeout = setTimeout(() => {
          setIsDeleting(false);
          setCurrentIndex((prev) => (prev + 1) % texts.length);
          setCharIndex(0);
        }, deletingSpeed);
      }
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [texts, currentIndex, charIndex, isDeleting, typingSpeed, deletingSpeed, pauseTime]);

  return displayText;
}
