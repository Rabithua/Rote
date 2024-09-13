import {
  LinkOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { toPng } from "html-to-image";
import { useState } from "react";
import QRCode from "react-qr-code";
import { saveAs } from "file-saver";

import toast from "react-hot-toast";
import moment from "moment";

function RoteShareCard({ rote }: any) {
  const themes = [
    {
      cardClass: "bg-white text-gray-800",
      tagClass: "bg-[#00000010] text-gray-800",
      authorClass: "text-gray-800",
      colorBlock: "bg-white border-gray-800",
      qrcodeColor: "#2d3748",
    },
    {
      cardClass: "bg-[#f5f5f5] text-[#255136]",
      tagClass: "bg-[#00000010] text-[#255136]",
      authorClass: "text-[#255136]",
      colorBlock: "bg-[#f5f5f5] border-[#255136]",
      qrcodeColor: "#255136",
    },
    {
      cardClass: "bg-zinc-800 text-white",
      tagClass: "bg-[#ffffff10] text-white",
      authorClass: "text-white",
      colorBlock: "bg-zinc-800 border-white",
      qrcodeColor: "#ffffff",
    },
    {
      cardClass: "bg-lime-300 text-gray-800",
      tagClass: "bg-[#00000010] text-gray-800",
      authorClass: "text-gray-800",
      colorBlock: "bg-lime-300 border-gray-800",
      qrcodeColor: "#2d3748",
    },
  ];
  const decoration = [
    {
      neme: "流星",
      class: "liuxing",
    },
  ];
  const [decorationIndex, setDecorationIndex] = useState<any>(null);
  const [themeIndex, setThemeIndex] = useState(1);

  async function saveImage(): Promise<void> {
    // toast.error("功能暂不可用");
    // return;
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
        cacheBust: true,
      };

      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );
      let dataUrl = "";
      let i = 0;
      let maxAttempts;
      if (isSafari) {
        maxAttempts = 5;
      } else {
        maxAttempts = 1;
      }

      let cycle = [];
      let repeat = true;

      while (repeat && i < maxAttempts) {
        dataUrl = await toPng(element, options);
        i += 1;
        cycle[i] = dataUrl.length;

        if (dataUrl.length > cycle[i - 1]) repeat = false;
      }

      if (!dataUrl) {
        toast.error("图片生成失败", {
          id: toastId,
        });
        return;
      }

      if (window.saveAs) {
        window.saveAs(dataUrl, `${rote.id}.png`);
      } else {
        saveAs(dataUrl, `${rote.id}.png`);
      }

      toast.success("图片已保存", {
        id: toastId,
      });
    } else {
      console.error("未找到要保存的元素");
    }
  }

  function copyLink() {
    let url = `${window.location.origin}/rote/${rote.id}`;
    navigator.clipboard.writeText(url);
    toast.success("链接已复制到剪贴板");
  }

  function ColorList() {
    return (
      <div className=" flex gap-2 mr-auto">
        {themes.map((theme: any, index: any) => {
          return colorBlock(theme, index);
        })}
      </div>
    );
  }

  function colorBlock(theme: any, index: any) {
    return (
      <div
        className={` w-6 h-6 cursor-pointer border border-r-8 rounded-full ${
          index === themeIndex ? "" : "opacity-20"
        } ${theme.colorBlock}`}
        key={`theme_${index}`}
        onClick={() => setThemeIndex(themes.indexOf(theme))}
      ></div>
    );
  }

  return (
    <div className=" cursor-default w-full flex flex-col gap-5">
      <div
        className={` w-full flex duration-300 flex-col gap-2 p-8 relative ${
          themes[themeIndex].cardClass
        } ${decorationIndex !== null && decoration[decorationIndex].class}`}
        id="shareCanva"
      >
        <div className="font-sm opacity-60">
          {moment().utc(rote.createdAt).format("YYYY/MM/DD HH:mm:ss")}
        </div>
        <div className=" md:text-xl break-words whitespace-pre-line font-medium font-serif tracking-wide	leading-7	">
          {rote.content}
        </div>
        {rote.attachments.length > 0 && (
          <div className=" w-full my-2 flex flex-wrap gap-1 rounded-2xl overflow-hidden">
            {rote.attachments.map((file: any, index: any) => {
              return (
                <img
                  key={`files_${index}`}
                  className={`attachmentImg ${
                    rote.attachments.length % 3 === 0
                      ? "w-[calc(1/3*100%-2.6667px)] aspect-1"
                      : rote.attachments.length % 2 === 0
                      ? "w-[calc(1/2*100%-2px)] aspect-1"
                      : rote.attachments.length === 1
                      ? " w-full max-w-[500px] rounded-2xl"
                      : "w-[calc(1/3*100%-2.6667px)] aspect-1"
                  } object-cover grow `}
                  src={file.url + "?" + new Date().getTime()}
                  alt=""
                  crossOrigin="anonymous"
                />
              );
            })}
          </div>
        )}
        <div className=" flex flex-wrap text-sm md:text-md gap-2 items-center font-serif">
          {rote.tags.map((tag: any, index: any) => {
            return (
              <span
                className={` px-2 py-1 md:px-3 font-bold rounded-md ${themes[themeIndex].tagClass}`}
                key={`tag_${index}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
        <div className=" mt-2  w-full flex justify-between">
          <div
            className={` flex items-center gap-2 ${themes[themeIndex].authorClass}`}
          >
            <img
              className=" w-10 rounded-md"
              src={rote.author.avatar + "?" + new Date().getTime()}
              alt=""
              crossOrigin="anonymous"
            />
            <div>
              <span className=" font-serif text-sm md:text-base font-semibold">
                {rote.author.nickname}
              </span>
              <div className=" hidden text-sm md:text-base sm:block font-normal opacity-60">
                来自 {window.location.origin}/{rote.author.username}
              </div>
            </div>
          </div>
          <div className=" w-10 h-10 shrink-0">
            <QRCode
              size={40}
              key={themeIndex}
              bgColor="transparent"
              fgColor={themes[themeIndex].qrcodeColor}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              value={`${window.location.origin}/${rote.author.username}`}
              viewBox={`0 0 256 256`}
            />
          </div>
        </div>
      </div>
      <div className=" flex flex-wrap gap-2 justify-end">
        <ColorList />
        <div
          className={` cursor-pointer select-none duration-300 flex items-center gap-2  px-4 py-1 rounded-md active:scale-95 ${
            decorationIndex !== null && "bg-gray-100"
          }`}
          onClick={() => {
            if (decorationIndex === null) {
              setDecorationIndex(0);
            } else {
              setDecorationIndex(null);
            }
          }}
        >
          <ThunderboltOutlined />
        </div>
        <div
          className=" cursor-pointer select-none duration-300 flex items-center gap-2 dark:bg-bgLight text-textDark dark:text-textLight px-4 py-1 rounded-md active:scale-95"
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
