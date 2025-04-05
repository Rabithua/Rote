import { ArrowUp, PanelTopClose } from "lucide-react";
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
    <div className="z-10 animate-show duration-300 fixed self-end right-8 bottom-16 flex flex-col gap-2">
      {/* 渲染子组件 */}
      {children}
      <div
        className="bg-bgDark dark:bg-bgLight w-fit py-2 px-4 rounded-md text-textDark dark:text-textLight cursor-pointer hover:scale-105 duration-300"
        onClick={goTop}
      >
        <ArrowUp className="size-4" />
      </div>
    </div>
  );
}
