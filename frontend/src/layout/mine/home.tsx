import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { observeElementInViewport } from "@/utils/observeElementInViewport";
import { t } from "i18next";
import { UpOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useRotes, useRotesDispatch } from "@/state/rotes";
import { apiGetMyRote } from "@/api/rote/main";
import toast from "react-hot-toast";

function LayoutHome() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });
  const [navHeight, setNavHeight] = useState(0);
  const [showscrollTop, setShowScrollTop] = useState(false);
  const [roteTypes, setRoteTypes] = useState([
    {
      name: "Rote",
      to: "rote",
      active: true,
    },
    {
      name: "Journal",
      to: "journal",
      active: false,
    },
    {
      name: "Todo",
      to: "todo",
      active: false,
    },
    {
      name: "Lucky",
      to: "lucky",
      active: false,
    },
    {
      name: "Article",
      to: "article",
      active: false,
    },
  ]);
  const navigate = useNavigate();
  const rotes = useRotes();
  const rotesDispatch = useRotesDispatch();

  useEffect(() => {
    checkRote();
    let topElement = document.getElementById("top") as any;
    if (!topElement) {
      return;
    }
    observeElementInViewport(topElement, (ifshow: boolean) => {
      setShowScrollTop(!ifshow);
    });

    const element = document.querySelector(".rotypesNav") as HTMLElement;
    setNavHeight(element.offsetHeight || 0);
  }, []);

  function checkRote() {
    const currentRoute = window.location.pathname; // 获取当前路由
    let newArr = roteTypes.map((route) => {
      if (currentRoute.includes(route.to)) {
        route.active = true;
      } else {
        route.active = false;
      }
      return route;
    });
    setRoteTypes(newArr);
  }

  function roteTypesChange(index: number) {
    if (roteTypes[index].active) {
      refreshData(index);
      return;
    }
    navigate(roteTypes[index].to);
    let newArr = roteTypes.map((type, i) => {
      if (i === index) {
        type.active = true;
        return type;
      } else {
        return {
          name: type.name,
          to: type.to,
          active: false,
        };
      }
    });

    setRoteTypes(newArr);
  }

  function refreshData(index: number) {
    const toastId = toast.loading("刷新中...");
    try {
      switch (index) {
        case 0:
          apiGetMyRote({
            limit: rotes.length,
            skip: 0,
          }).then((res) => {
            const rotes_api = res.data.data;
            toast.success("数据已刷新", {
              id: toastId,
            });
            rotesDispatch({
              type: "freshAll",
              rotes: rotes_api,
            });
          });
          break;

        default:
          toast.dismiss(toastId);
          break;
      }
    } catch (error) {
      toast.error("刷新失败", {
        id: toastId,
      });
    }
  }

  function goTop() {
    const containers = document.getElementsByClassName("scrollContainer");
    if (containers.length > 0) {
      const container = containers[0]; // 获取第一个匹配的元素
      container.scrollTop = 0; // 将该容器滚动到顶部
    }
  }
  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
      style={{ scrollPaddingTop: `${navHeight}px` }}
    >
      <div className=" rotypesNav duration-300 sticky top-0 z-10 w-full flex overflow-x-scroll noScrollBar items-center sm:justify-center border-b border-[#00000010] bg-[#ffffff99] backdrop-blur-xl">
        {roteTypes.map((type, index) => {
          return (
            <div
              className={` cursor-pointer duration-300 border-b-2 py-2 px-5 shrink-0 font-semibold hover:bg-[#00000010] ${
                type.active
                  ? " bg-[#00000010] border-black "
                  : " border-transparent"
              }`}
              key={`roteType_${index}`}
              onClick={() => roteTypesChange(index)}
            >
              {t(`roteTypes.${index}`)}
            </div>
          );
        })}
      </div>
      <div id="top"></div>
      <Outlet />

      {showscrollTop && (
        <div
          className=" animate-show duration-300 fixed self-end right-8 bottom-8 bg-black w-fit py-2 px-4 rounded-md text-white cursor-pointer hover:text-white"
          onClick={goTop}
        >
          <UpOutlined />
        </div>
      )}
    </div>
  );
}

export default LayoutHome;
