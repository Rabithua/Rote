import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import RoteInputSimple from "@/components/roteInputSimple";
import { useNavigate } from "react-router-dom";
import { LoadingOutlined, UpOutlined } from "@ant-design/icons";
import Rote from "@/components/Rote";
import { apiGetMyRote } from "@/api/rote/main";
import { Empty } from "antd";
import { useProfile } from "@/state/profile";
import { useRotes, useRotesDispatch } from "@/state/rotes";

function RotePage() {
  const navigate = useNavigate();
  const loadingRef = useRef(null);
  const [isLoadAll, setIsLoadAll] = useState(false);
  const rotes = useRotes();
  const rotesDispatch = useRotesDispatch();

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

  return (
    <>
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
            className=" flex justify-center items-center py-8 h- gap-3 bg-white"
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
    </>
  );
}

export default RotePage;
