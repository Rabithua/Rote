import {
  checkPermission,
  registerSW,
  requestNotificationPermission,
} from "@/utils/main";
import { ExperimentOutlined, NotificationFilled } from "@ant-design/icons";
import Switch from "antd/es/switch";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import Divider from "antd/es/divider";
import {
  deleteSubscription,
  saveSubscription,
  sendNotificationTest,
} from "@/api/subscription/main";
import NavHeader from "@/components/navHeader";

export default function ExperimentPage() {
  const [swReady, setSwReady] = useState(false);
  const [swLoading, setSwLoading] = useState(true);
  const [noticeId, setNoticeId] = useState<any>(null);

  useEffect(() => {
    listenSw();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(async (registration) => {
        if (registration) {
          try {
            registration?.active?.postMessage({ method: "subNotice" });
          } catch (error) {}
          // console.log("Service Worker is installed.");
        } else {
          // console.log("Service Worker is not installed.");
        }
        setSwLoading(false);
      });
    } else {
      setSwLoading(false);
      console.log("Service Worker is not supported.");
    }
  }, []);

  function listenSw() {
    console.log("listenSw");
    navigator.serviceWorker.removeEventListener("message", async (event) => {});
    navigator.serviceWorker.addEventListener("message", async (event) => {
      if (event.data.method === "subNoticeResponse") {
        try {
          const response = await saveSubscription(
            JSON.parse(event.data.payload)
          );
          if (response.data.data.id) {
            setSwLoading(false);
            setSwReady(true);
            setNoticeId(response.data.data.id);
          }
        } catch (error) {}
      }
    });
  }

  async function sub() {
    const toastId = toast.loading("权限处理中...");
    try {
      setSwLoading(true);
      checkPermission();
      await requestNotificationPermission();
      await registerSW();
      try {
        const registration = await registerSW();

        if (registration) {
          console.log(registration);
          try {
            listenSw();
            setTimeout(() => {
              registration?.active?.postMessage({ method: "subNotice" });
            }, 300);
          } catch (error) {}
          console.log("Service Worker is installed.");
        } else {
          console.log("Service Worker is not installed.");
        }
      } catch (error) {}
      toast.success("完成", {
        id: toastId,
      });
      setSwReady(true);
    } catch (error: any) {
      toast.error(error, {
        id: toastId,
      });
    }
  }
  async function unSub() {
    setSwLoading(true);
    deleteSubscription(noticeId)
      .then((res) => {
        setSwLoading(false);
        setNoticeId(null);
        setSwReady(false);
      })
      .catch((err) => {
        setSwLoading(false);
        console.log(err);
      });
  }

  async function noticeTest() {
    try {
      const resp = await sendNotificationTest(noticeId);
      console.log(resp);
      toast.success("发送成功！");
    } catch (error) {}
  }
  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <NavHeader title="实验室 / Experimanet" icon={<ExperimentOutlined />} />
      <div className=" flex flex-col w-full gap-1">
        <div className=" bg-bgWhite m-2 py-3 px-4 rounded-lg">
          实验性质小功能，有可能会让rote变得更好用🤩
        </div>
        <div className=" m-2 flex gap-2 flex-wrap">
          <div className=" w-full md:w-[calc(50%-4px)] relative overflow-y-scroll overflow-x-hidden aspect-1 border border-[#00000015] rounded-xl p-4">
            <div className=" text-2xl font-semibold">
              ServiceWoker通知 <br />
              <div className=" font-normal mt-2 text-sm text-gray-500">
                ServiceWorker可以使用某些高级功能，比如后台通知等。
              </div>
            </div>
            <Divider></Divider>
            <div className=" flex gap-2 items-center">
              <span className=" font-semibold">状态：</span>
              <Switch
                disabled={!navigator.serviceWorker}
                className=" bg-bgWhite"
                checked={swReady}
                loading={swLoading}
                size="default"
                onChange={(e) => {
                  if (e) {
                    sub();
                  } else {
                    unSub();
                  }
                }}
              />
            </div>
            {noticeId && (
              <div className=" flex mt-2 text-gray-500 gap-2 items-center">
                <span className=" shrink-0">服务标识:</span>
                <span className=" text-ellipsis overflow-hidden">
                  {noticeId}
                </span>
                <div
                  className=" duration-300 active:scale-95 py-1 shrink-0 px-2 bg-bgWhite cursor-pointer rounded-md flex gap-1"
                  onClick={noticeTest}
                >
                  <NotificationFilled />
                  通知测试
                </div>
              </div>
            )}
            {noticeId && (
              <div className=" mt-2 flex flex-col gap-2">
                <div className=" font-semibold">使用示例：</div>
                <div className=" whitespace-pre text-red-700 font-mono overflow-x-scroll p-3 rounded-xl bg-bgWhite">
                  {`curl --location '${process.env.REACT_APP_BASEURL_PRD}/v1/api/sendSwSubScription?subId=${noticeId}' 
--header 'Content-Type: application/json' 
--data '{
    "title": "自在废物",
    "body": "这是我的博客。",
    "image": "https://r2.rote.ink/others/logo.png",
    "data": {
      "type": "openUrl",
      "url": "https://rabithua.club"
    }
  }'`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div id="top" className=" h-[1px]"></div>
    </div>
  );
}
