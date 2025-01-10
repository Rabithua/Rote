import { useTempState } from "@/state/others";
import { Rote, Rotes } from "@/types/main";
import { LoadingOutlined } from "@ant-design/icons";
import Empty from "antd/es/empty";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import RoteItem from "./roteItem";

function RoteList({ api, apiProps }: { api: any; apiProps: any }) {
  const [rotesToRender, setRotesToRender] = useState<Rotes>([]);
  const [tempState, setTempState] = useTempState();

  const { t } = useTranslation("translation", {
    keyPrefix: "components.roteList",
  });

  const countRef = useRef<number>(0);
  const loading = useRef<boolean>(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    countRef.current = rotesToRender.length;
  }, [rotesToRender.length]);

  useEffect(() => {
    if (
      tempState.editOne ||
      tempState.sendNewOne ||
      tempState.removeOne ||
      tempState.newAttachments
    ) {
      setHasMore(true);
      if (tempState.editOne) {
        setRotesToRender((prev) => {
          return prev.map((r) => {
            if (r.id === tempState.editOne?.id) {
              return tempState.editOne as Rote;
            }
            return r;
          });
        });
      }

      if (tempState.sendNewOne) {
        setRotesToRender((prev) => {
          return [tempState.sendNewOne as Rote, ...prev];
        });
      }

      if (tempState.removeOne !== null) {
        setRotesToRender((prev) => {
          return prev.filter((r) => r.id !== tempState.removeOne);
        });
      }

      if (tempState.newAttachments) {
        setRotesToRender((prev) => {
          return prev.map((r) => {
            return r.id === tempState.newAttachments![0].roteid
              ? {
                  ...r,
                  attachments: [...r.attachments, ...tempState.newAttachments!],
                }
              : r;
          });
        });
      }

      setTempState({
        editOne: null,
        sendNewOne: null,
        removeOne: null,
        newAttachments: null,
      });
    }
  }, [tempState]);

  // 监听loaderRef显示事件，加载更多
  useEffect(() => {
    const currentloaderRef = loaderRef.current;

    if (!currentloaderRef) {
      return;
    }

    const options = {
      root: null, // 使用视口作为根元素
      rootMargin: "0px", // 根元素的边距
      threshold: 0.5, // 元素可见度的阈值
    };

    let observer: IntersectionObserver;

    function loadMore() {
      if (loading.current === true || !hasMore) return;

      loading.current = true;

      api({
        skip: countRef.current,
        ...apiProps,
      })
        .then((res: any) => {
          if (res.data.data.length !== 20) {
            setHasMore(false);
          }

          setRotesToRender([...rotesToRender, ...res.data.data]);
          countRef.current += res.data.data.length;
        })
        .catch(() => {})
        .finally(() => {
          loading.current = false;
        });
    }

    observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        loadMore();
      }
    }, options);

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [rotesToRender]);

  useEffect(() => {
    setRotesToRender([]);
    setHasMore(true);

    api(apiProps)
      .then((res: any) => {
        if (res.data.data.length !== 20) {
          setHasMore(false);
        }

        setRotesToRender(res.data.data);
        countRef.current = res.data.data.length;
      })
      .catch(() => {});
  }, [apiProps]);

  function updateRote(rote: Rote) {
    setRotesToRender((prev) => {
      return prev.map((r) => {
        if (r.id === rote.id) {
          return rote;
        }
        return r;
      });
    });
  }

  return (
    <div className=" flex flex-col w-full relative">
      {rotesToRender.map((item: any, index: any) => {
        return <RoteItem rote_param={item} key={item.id}></RoteItem>;
      })}
      {!hasMore ? null : (
        <div
          ref={loaderRef}
          className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark"
        >
          <LoadingOutlined />
        </div>
      )}
      {!hasMore && rotesToRender.length === 0 ? (
        <div className=" shrink-0 dark:border-opacityDark bg-bgLight dark:bg-bgDark py-4">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("empty")}
          />
        </div>
      ) : null}
    </div>
  );
}

export default RoteList;
