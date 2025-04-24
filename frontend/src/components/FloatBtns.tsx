import { ArrowUp } from "lucide-react";
import { ReactNode } from "react";

export default function FloatBtns({
  scrollContainerName,
  children,
}: {
  scrollContainerName?: string;
  children?: ReactNode;
}) {
  function goTop() {
    const container = scrollContainerName
      ? document.querySelector(scrollContainerName)
      : window;

    if (container) {
      console.log(container);
      if (container === window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (container instanceof HTMLElement) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }

  return (
    <div className="fixed bottom-16 right-8 z-10 flex animate-show flex-col gap-2 self-end duration-300">
      {/* 渲染子组件 */}
      {children}
      <div
        className="w-fit cursor-pointer rounded-md bg-bgDark px-4 py-2 text-textDark duration-300 hover:scale-105 dark:bg-bgLight dark:text-textLight"
        onClick={goTop}
      >
        <ArrowUp className="size-4" />
      </div>
    </div>
  );
}
