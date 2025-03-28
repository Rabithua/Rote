import {
  deleteSubscription,
  saveSubscription,
  sendNotificationTest,
} from "@/api/subscription/main";
import {
  checkPermission,
  registerSW,
  requestNotificationPermission,
} from "@/utils/main";
import { Divider, Switch } from "antd";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function ServiceWorker() {
  const { t } = useTranslation("translation", {
    keyPrefix: "pages.experiment.serviceWorker",
  });
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
            JSON.parse(event.data.payload),
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
    const toastId = toast.loading(t("permissionProcessing"));
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
      toast.success(t("complete"), {
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
      toast.success(t("sendSuccess"));
    } catch (error) {}
  }

  return (
    <div className=" w-full sm:w-[calc(50%-4px)] noScrollBar relative overflow-y-scroll overflow-x-hidden aspect-1 border-b p-4">
      <div className=" text-2xl font-semibold">
        {t("title")} <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          {t("description")}
        </div>
      </div>
      <Divider></Divider>
      <div className=" flex gap-2 items-center">
        <span className=" font-semibold">{t("status")}</span>
        <Switch
          disabled={!navigator.serviceWorker}
          className=" bg-bgLight dark:bg-bgDark"
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
          <span className=" shrink-0">{t("serviceId")}</span>
          <span className=" text-ellipsis overflow-hidden">{noticeId}</span>
          <div
            className=" duration-300 items-center active:scale-95 py-1 shrink-0 px-2 bg-bgLight cursor-pointer rounded-md flex gap-1"
            onClick={noticeTest}
          >
            <Bell className="size-4" />
            {t("notificationTest")}
          </div>
        </div>
      )}
      {noticeId && (
        <div className=" mt-2 flex flex-col gap-2">
          <div className=" font-semibold">{t("example")}</div>
          <div className=" whitespace-pre text-red-700 dark:text-white font-mono overflow-x-scroll p-3 rounded-xl bg-opacityLight dark:bg-opacityDark">
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
  );
}
