import { LinkOutlined, SaveOutlined } from "@ant-design/icons";
import { Divider } from "antd";
import { toBlob } from "html-to-image";
import toast from "react-hot-toast";

function RoteShareCard({ rote }: any) {
  function saveImage(): void {
    const toastId = toast.loading("正在生成图片...");
    const element: any = document.querySelector("#shareCanva");
    if (element) {
      // 获取元素的宽度和高度
      const width = element.clientWidth;
      const height = element.clientHeight;

      // 配置 html2canvas 选项
      const options: any = {
        width: width,
        height: height,
        canvasWidth: (width * 720) / width,
        canvasHeight: (height * 720) / width,
        backgroundColor: null,
      };

      toBlob(element, options).then((blob: any) => {
        if (!blob) {
          toast.error("生成图片失败", {
            id: toastId,
          });
          return;
        }
        // 下载图片
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${rote.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("图片已保存", {
          id: toastId,
        });
      });
    } else {
      console.error("未找到要保存的元素");
    }
  }

  function copyLink() {
    let url = `${window.location.href}/rote/${rote.id}`;
    navigator.clipboard.writeText(url);
    toast.success("链接已复制到剪贴板");
  }

  return (
    <div className=" cursor-default bg-white w-full flex flex-col gap-5">
      <div
        className=" w-full flex flex-col gap-2 p-8 rounded-xl bg-white relative"
        id="shareCanva"
      >
        <div className=" font-extrabold text-5xl text-gray-800 mb-[-10px]">
          “
        </div>
        <div className=" text-base text-gray-800 break-words whitespace-pre-line font-medium font-serif tracking-wide	leading-7	">
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
                  crossOrigin=""
                />
              );
            })}
          </div>
        )}
        <div className=" flex flex-wrap gap-2 items-center font-serif">
          {rote.tags.map((tag: any, index: any) => {
            return (
              <span
                className=" px-2 py-1 text-xs rounded-md bg-[#00000010]"
                key={`tag_${index}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
        <Divider />
        <div className=" w-full flex flex-wrap">
          <img
            className=" w-6 h-6 mr-2 rounded-full"
            src={rote.author.avatar}
            alt=""
          />
          <span className=" font-serif font-semibold text-gray-800">
            {rote.author.nickname}
          </span>
          <span className=" text-nowrap ml-auto font-normal text-gray-500">
            来自 Rote.ink/{rote.author.username}
          </span>
        </div>
      </div>
      <div className=" flex gap-2 justify-end">
        <div
          className=" cursor-pointer select-none duration-300 flex items-center gap-2 bg-gray-100 px-4 py-1 rounded-md active:scale-95"
          onClick={copyLink}
        >
          <LinkOutlined />
          复制链接
        </div>
        <div
          className=" cursor-pointer select-none duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95"
          onClick={saveImage}
        >
          <SaveOutlined />
          保存
        </div>
      </div>
    </div>
  );
}

export default RoteShareCard;
