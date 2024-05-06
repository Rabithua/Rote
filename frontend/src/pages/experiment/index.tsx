import {
  checkPermission,
  registerSW,
  requestNotificationPermission,
  subNotice,
} from "@/utils/main";
import { ExperimentOutlined, NotificationFilled } from "@ant-design/icons";
import Switch from "antd/es/switch";
import * as animationData from "@/json/Animation - 1714545494540.json";
import Lottie from "lottie-react";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import Divider from "antd/es/divider";
import {
  saveSubscription,
  sendNotificationTest,
} from "@/api/subscription/main";

export default function ExperimentPage() {
  const [swReady, setSwReady] = useState(false);
  const [swLoading, setSwLoading] = useState(true);
  const [noticeId, setNoticeId] = useState<any>(null);

  useEffect(() => {
    navigator.serviceWorker.addEventListener("message", async (event) => {
      if (event.data.method === "subNoticeResponse") {
        try {
          const response = await saveSubscription(
            JSON.parse(event.data.payload)
          );
          console.log(response);
          setNoticeId(response.data.data.id);
        } catch (error) {}
      }
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(async (registration) => {
        if (registration) {
          setSwReady(true);
          try {
            const e: any = await subNotice();
            setNoticeId(e.data.data.id);
          } catch (error) {}
          // console.log("Service Worker is installed.");
        } else {
          setSwReady(false);
          // console.log("Service Worker is not installed.");
        }
        setSwLoading(false);
      });
    } else {
      setSwLoading(false);
      console.log("Service Worker is not supported.");
    }
  }, []);

  async function sub() {
    const toastId = toast.loading("权限处理中...");
    try {
      checkPermission();
      await requestNotificationPermission();
      await registerSW();
      try {
        await subNotice();
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

    // const title = "PWA-Book-Demo Notification Title";
    // const options = {
    //   body: "Simple piece of body text.\nSecond line of body text :)",
    // };
    // const notification = new Notification(title, options);
    // console.log(notification  );
  }

  async function noticeTest() {
    try {
      const resp = await sendNotificationTest(noticeId);
      console.log(resp);
      toast.success("发送成功！")
      
    } catch (error) {
      
    }
  }
  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-lvh overflow-y-visible overflow-x-hidden relative`}
    >
      <div className=" sticky top-0 z-10">
        <div className=" flex gap-2 bg-white text-2xl font-semibold p-4">
          <ExperimentOutlined />
          实验室 / Experimanet
        </div>

        <div className=" flex flex-col gap-1">
          <div className=" bg-bgWhite m-2  w-full py-3 px-4 rounded-lg">
            注册ServiceWorker，订阅通知
          </div>
          <div className=" m-2 flex gap-2 flex-wrap">
            <div className=" w-full md:w-[calc(50%-4px)] relative overflow-y-scroll overflow-x-hidden aspect-1 border border-[#00000015] rounded-xl p-4">
              <div className=" text-2xl font-semibold">
                ServiceWoker <br />
                <div className=" font-normal mt-2 text-sm text-gray-500">
                  ServiceWorker可以使用某些高级功能，比如后台通知等。
                </div>
              </div>
              <Divider></Divider>
              <div className=" flex gap-2 items-center">
                状态：
                <Switch
                  checked={swReady}
                  loading={swLoading}
                  size="default"
                  onChange={(e) => {
                    if (e) {
                      sub();
                    } else {
                      // 取消订阅通知
                      sub();
                    }
                  }}
                />
              </div>
              {noticeId && (
                <div className=" flex mt-2 text-gray-500 gap-2 items-center">
                  服务标识: {noticeId}
                  <div
                    className=" py-1 px-2 bg-bgWhite cursor-pointer rounded-md flex gap-1"
                    onClick={noticeTest}
                  >
                    <NotificationFilled />
                    通知测试
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div id="top" className=" h-[1px]"></div>
    </div>
  );
}
