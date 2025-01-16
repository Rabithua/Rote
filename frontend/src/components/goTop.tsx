import { UpOutlined } from "@ant-design/icons";

export default function GoTop({
  scrollContainerName,
}: {
  scrollContainerName?: string;
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
    <div
      className="z-10 animate-show duration-300 fixed self-end right-8 bottom-16 bg-bgDark dark:bg-bgLight w-fit py-2 px-4 rounded-md text-textDark dark:text-textLight cursor-pointer"
      onClick={goTop}
    >
      <UpOutlined />
    </div>
  );
}
