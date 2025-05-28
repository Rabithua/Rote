'use client';

import * as React from 'react';
import { motion, useInView, type UseInViewOptions } from 'motion/react';

import { cn } from '@/lib/utils';

function CursorBlinker({ className }: { className?: string }) {
  return (
    <motion.span
      data-slot="cursor-blinker"
      variants={{
        blinking: {
          opacity: [0, 0, 1, 1],
          transition: {
            duration: 1,
            repeat: Infinity,
            repeatDelay: 0,
            ease: 'linear',
            times: [0, 0.5, 0.5, 1],
          },
        },
      }}
      animate="blinking"
      className={cn(
        'inline-block h-5 w-[1px] translate-y-1 bg-black dark:bg-white',
        className,
      )}
    />
  );
}

type TypingTextProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  duration?: number;
  delay?: number;
  inView?: boolean;
  inViewMargin?: UseInViewOptions['margin'];
  inViewOnce?: boolean;
  cursor?: boolean;
  loop?: boolean;
  holdDelay?: number;
  text: string | string[];
  cursorClassName?: string;
};

function TypingText({
  ref,
  duration = 100,
  delay = 0,
  inView = false,
  inViewMargin = '0px',
  inViewOnce = true,
  cursor = false,
  loop = false,
  holdDelay = 1000,
  text,
  cursorClassName,
  ...props
}: TypingTextProps) {
  const localRef = React.useRef<HTMLSpanElement>(null);
  React.useImperativeHandle(ref, () => localRef.current as HTMLSpanElement);

  const inViewResult = useInView(localRef, {
    once: inViewOnce,
    margin: inViewMargin,
  });
  const isInView = !inView || inViewResult;

  const [started, setStarted] = React.useState(false);
  const [displayedText, setDisplayedText] = React.useState<string>('');

  React.useEffect(() => {
    if (isInView) {
      const timeoutId = setTimeout(() => {
        setStarted(true);
      }, delay);
      return () => clearTimeout(timeoutId);
    } else {
      const timeoutId = setTimeout(() => {
        setStarted(true);
      }, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [isInView, delay]);

  React.useEffect(() => {
    if (!started) return;
    const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
    const texts: string[] = typeof text === 'string' ? [text] : text;

    const typeText = (str: string, onComplete: () => void) => {
      let currentIndex = 0;
      const type = () => {
        if (currentIndex <= str.length) {
          setDisplayedText(str.substring(0, currentIndex));
          currentIndex++;
          const id = setTimeout(type, duration);
          timeoutIds.push(id);
        } else {
          onComplete();
        }
      };
      type();
    };

    const eraseText = (str: string, onComplete: () => void) => {
      let currentIndex = str.length;
      const erase = () => {
        if (currentIndex >= 0) {
          setDisplayedText(str.substring(0, currentIndex));
          currentIndex--;
          const id = setTimeout(erase, duration);
          timeoutIds.push(id);
        } else {
          onComplete();
        }
      };
      erase();
    };

    const animateTexts = (index: number) => {
      typeText(texts[index] ?? '', () => {
        const isLast = index === texts.length - 1;
        if (isLast && !loop) {
          return;
        }
        const id = setTimeout(() => {
          eraseText(texts[index] ?? '', () => {
            const nextIndex = isLast ? 0 : index + 1;
            animateTexts(nextIndex);
          });
        }, holdDelay);
        timeoutIds.push(id);
      });
    };

    animateTexts(0);

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [text, duration, started, loop, holdDelay]);

  return (
    <span ref={localRef} data-slot="typing-text" {...props}>
      <motion.span>{displayedText}</motion.span>
      {cursor && <CursorBlinker className={cursorClassName} />}
    </span>
  );
}

export { TypingText, type TypingTextProps };
