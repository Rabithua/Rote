import { SaveOutlined } from "@ant-design/icons";
import { Divider } from "antd";
import html2canvas from "html2canvas";

function RoteShareCard({ rote }: any) {
  function saveImage(): void {
    const element: any = document.querySelector("#shareCanva");
    if (element) {
      // 获取元素的宽度和高度
      const width = element.clientWidth;
      const height = element.clientHeight;

      // 配置 html2canvas 选项
      const options: any = {
        scale: 1080 / width, // 设置缩放比例为 2
        width: width,
        height: height,
        useCORS: true, // 允许跨域图像
        backgroundColor: null,
      };

      html2canvas(element, options).then((canvas: HTMLCanvasElement) => {
        // 将生成的图像添加到文档中
        document.body.appendChild(canvas);

        // 创建一个临时链接用于下载图像
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "image.png";

        // 触发链接的点击事件以开始下载
        link.click();

        // 清理:从文档中移除临时链接和画布
        link.remove();
        canvas.remove();
      });
    } else {
      console.error("未找到要保存的元素");
    }
  }

  return (
    <div className=" cursor-default bg-white w-full flex flex-col gap-5">
      <div
        className=" w-full flex flex-col gap-2 p-8 rounded-xl bg-bgWhite relative"
        id="shareCanva"
      >
        <div className=" font-extrabold text-5xl text-gray-800 mb-[-10px]">
          “
        </div>
        <div className=" text-base text-gray-800 break-words whitespace-pre-line font-serif">
          {rote.content}
        </div>
        {rote.attachments.length > 0 && (
          <div className=" w-full my-2 flex flex-wrap gap-1 rounded-2xl overflow-hidden">
            {rote.attachments.map((file: any, index: any) => {
              return (
                <img
                  key={`files_${index}`}
                  className={` ${
                    rote.attachments.length % 3 === 0
                      ? "w-[calc(1/3*100%-2.6667px)] aspect-1"
                      : rote.attachments.length % 2 === 0
                      ? "w-[calc(1/2*100%-2px)] aspect-1"
                      : rote.attachments.length === 1
                      ? " w-full max-w-[500px] rounded-2xl"
                      : "w-[calc(1/3*100%-2.6667px)] aspect-1"
                  } object-cover grow `}
                  src={file.url}
                  alt=""
                />
              );
            })}
          </div>
        )}
        <div className=" flex flex-wrap gap-2 items-center font-serif">
          {rote.tags.map((tag: any, index: any) => {
            return (
              <span className=" text-gray-500" key={`tag_${index}`}>
                #{tag}
              </span>
            );
          })}
        </div>
        <Divider />
        <div className=" w-full flex flex-wrap">
          {/* <img className=" w-6 h-6 mr-2 rounded-full" src={rote.author.avatar} alt="" /> */}
          <span className=" font-serif font-semibold text-gray-800">
            {rote.author.nickname}
          </span>
          <span className=" text-nowrap ml-auto font-normal text-gray-500">
            来自 Rote.ink/{rote.author.username}
          </span>
        </div>
      </div>

      <div
        className=" cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95"
        onClick={saveImage}
      >
        <SaveOutlined />
        保存
      </div>
    </div>
  );
}

export default RoteShareCard;
