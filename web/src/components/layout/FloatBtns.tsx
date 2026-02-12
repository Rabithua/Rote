import { ArrowUp } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '../ui/button';

export default function FloatBtns({
  scrollContainerName,
  children,
}: {
  scrollContainerName?: string;
  children?: ReactNode;
}) {
  function goTop() {
    const container = scrollContainerName ? document.querySelector(scrollContainerName) : window;

    if (container) {
      if (container === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (container instanceof HTMLElement) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  return (
    <div className="animate-show fixed right-8 bottom-16 z-10 flex flex-col gap-2 self-end duration-300">
      {/* 渲染子组件 */}
      {children}
      <Button
        size="icon"
        className="rounded-md shadow-md"
        onClick={goTop}
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp className="size-4" />
      </Button>
    </div>
  );
}
