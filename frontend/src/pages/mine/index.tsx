import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import RoteInputSimple from "@/components/roteInputSimple";
import { useNavigate } from "react-router-dom";
import { LoadingOutlined, UpOutlined } from "@ant-design/icons";
import Rote from "@/components/Rote";
import { apiGetMyRote } from "@/api/rote/main";
import LayoutDashboadrd from "@/layout/dashboard";
import { Empty } from "antd";
import { useProfile } from "@/state/profile";
import { useRotes, useRotesDispatch } from "@/state/rotes";
import { debounce } from "@/utils/main";
import { observeElementInViewport } from "@/utils/observeElementInViewport";

function Mine() {
  const navigate = useNavigate();
  const loadingRef = useRef(null);
  const [isLoadAll, setIsLoadAll] = useState(false);
  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });
  const [showscrollTop, setShowScrollTop] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const rotes = useRotes();
  const rotesDispatch = useRotesDispatch();

  const [roteTypes, setRoteTypes] = useState([
    {
      name: "Rote",
      active: true,
    },
    {
      name: "Journal",
      active: false,
    },
    {
      name: "Todo",
      active: false,
    },
    {
      name: "Lucky",
      active: false,
    },
    {
      name: "Article",
      active: false,
    },
  ]);

  const profile = useProfile();

  useEffect(() => {
    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: "0px", // 根元素的边距
      threshold: 0.5, // 元素可见度的阈值
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 元素进入视口
          apiGetMyRote({
            limit: 20,
            skip: rotes.length,
          })
            .then((res) => {
              const rotes_api = res.data.data;
              if (rotes_api.length !== 20) {
                setIsLoadAll(true);
              }
              rotesDispatch({
                type: "add",
                rotes: rotes_api,
              });
            })
            .catch((err) => {});
        }
      });
    }, options);

    if (loadingRef.current && profile) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [profile]);

  useEffect(() => {
    observeElementInViewport(
      document.getElementById("top") as any,
      (ifshow: boolean) => {
        setShowScrollTop(!ifshow);
      }
    );

    const element = document.querySelector(".rotypesNav") as HTMLElement;
    console.log(element.offsetHeight);
    setNavHeight(element.offsetHeight || 0);
  }, []);

  function roteTypesChange(index: number) {
    let newArr = roteTypes.map((type, i) => {
      if (i === index) {
        type.active = true;
        return type;
      } else {
        return {
          name: type.name,
          active: false,
        };
      }
    });

    setRoteTypes(newArr);
  }

  return profile ? (
    <LayoutDashboadrd>
      <div
        className={` scrollContainer scroll-smooth flex-1 noScrollBar h-screen overflow-y-visible overflow-x-hidden relative`}
        style={{ scrollPaddingTop: `${navHeight}px` }}
      >
        <div className=" rotypesNav duration-300 sticky top-0 z-10 w-full flex overflow-x-scroll noScrollBar items-center sm:justify-center border-b border-[#00000010] dark:border-[#ffffff05] bg-[#ffffff99] backdrop-blur-xl dark:bg-black dark:text-white">
          {roteTypes.map((type, index) => {
            return (
              <div
                className={` cursor-pointer duration-300 border-b-2 py-2 px-5 shrink-0 font-semibold hover:bg-[#00000010] dark:hover:bg-[#ffffff05] ${
                  type.active
                    ? " bg-[#00000010] border-black dark:border-white"
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
        <RoteInputSimple profile={profile}></RoteInputSimple>
        <div className=" flex flex-col w-full relative">
          {rotes.map((item: any, index: any) => {
            return (
              <Rote
                profile={profile}
                rote_param={item}
                key={`Rote_${index}`}
              ></Rote>
            );
          })}
          {isLoadAll ? null : (
            <div
              ref={loadingRef}
              className=" flex justify-center items-center py-3 gap-3"
            >
              <LoadingOutlined />
              <div>加载中...</div>
            </div>
          )}
          {isLoadAll && rotes.length === 0 ? (
            <div className=" border-t-[1px] border-[#00000010] bg-white py-4">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={"这里什么也没有"}
              />
            </div>
          ) : null}
        </div>

        {showscrollTop && (
          <a
            className=" animate-show duration-300 fixed self-end right-8 bottom-8 bg-black w-fit py-2 px-4 rounded-md text-white cursor-pointer hover:text-white"
            href="#top"
          >
            <UpOutlined />
          </a>
        )}
      </div>
    </LayoutDashboadrd>
  ) : null;
}

export default Mine;
