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
      className=" animate-show duration-300 fixed self-end right-8 bottom-8 bg-black w-fit py-2 px-4 rounded-md text-white cursor-pointer hover:text-white"
      onClick={goTop}
    >
      <UpOutlined />
    </div>
  );
}
