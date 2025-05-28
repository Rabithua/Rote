import { ArrowUp } from 'lucide-react';
import { type ReactNode } from 'react';

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
      <div
        className="bg-bgDark text-textDark dark:bg-bgLight dark:text-textLight w-fit cursor-pointer rounded-md px-4 py-2 duration-300 hover:scale-105"
        onClick={goTop}
      >
        <ArrowUp className="size-4" />
      </div>
    </div>
  );
}
