import { UpOutlined } from "@ant-design/icons";

export default function GoTop({ scrollContainerName }: any) {
  function goTop() {
    const containers = document.getElementsByClassName(scrollContainerName);
    if (containers.length > 0) {
      const container = containers[0]; // 获取第一个匹配的元素
      container.scrollTop = 0; // 将该容器滚动到顶部
    }
  }

  return (
    <div
      className=" z-10 animate-show duration-300 fixed self-end right-8 bottom-8 bg-bgDark dark:bg-bgLight w-fit py-2 px-4 rounded-md text-textDark dark:text-textLight cursor-pointer"
      onClick={goTop}
    >
      <UpOutlined />
    </div>
  );
}
