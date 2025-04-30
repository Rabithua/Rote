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

  const initializeServiceWorker = async () => {
    const registration = await navigator.serviceWorker.getRegistration();

    try {
      listenSw();

      if (registration && registration.active) {
        registration.active.postMessage({ method: "subNotice" });
      } else {
        console.log("Service Worker is not installed.");
      }
    } catch (error) {
      console.error("Error initializing Service Worker:", error);
    } finally {
      setSwLoading(false);
    }
  };

  function listenSw() {
    navigator.serviceWorker.removeEventListener("message", async (event) => {});
    navigator.serviceWorker.addEventListener("message", async (event) => {
      switch (event.data.method) {
        case "subNoticeResponse":
          {
            const response = await saveSubscription(
              JSON.parse(event.data.payload),
            );
            if (response.data.data.id) {
              setSwLoading(false);
              setSwReady(true);
              setNoticeId(response.data.data.id);
            }
          }
          break;

        default:
          console.warn("Unknown message from Service Worker:", event.data);
          break;
      }
    });
  }

  async function sub() {
    const toastId = toast.loading(t("permissionProcessing"));
    try {
      setSwLoading(true);
      checkPermission();
      await requestNotificationPermission();
      const registration = await registerSW();

      if (!registration.active) {
        return toast.error(t("swNotActive"), {
          id: toastId,
        });
      }

      initializeServiceWorker();
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

  useEffect(() => {
    if (navigator.serviceWorker) {
      setSwLoading(true);
      initializeServiceWorker();
    } else {
      setSwLoading(false);
    }

    return () => {
      navigator.serviceWorker.removeEventListener("message", listenSw);
    };
  }, []);

  return (
    <div className="noScrollBar relative aspect-1 w-full overflow-x-hidden overflow-y-scroll border-b p-4 sm:w-[calc(50%-4px)]">
      <div className="text-2xl font-semibold">
        {t("title")} <br />
        <div className="mt-2 text-sm font-normal text-gray-500">
          {t("description")}
        </div>
      </div>
      <Divider></Divider>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{t("status")}</span>
        <Switch
          disabled={!navigator.serviceWorker}
          className="bg-opacityLight dark:bg-opacityDark"
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
        <div className="mt-2 flex items-center gap-2 text-gray-500">
          <span className="shrink-0">{t("serviceId")}</span>
          <span className="overflow-hidden text-ellipsis">{noticeId}</span>
          <div
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-bgLight px-2 py-1 duration-300 active:scale-95"
            onClick={noticeTest}
          >
            <Bell className="size-4" />
            {t("notificationTest")}
          </div>
        </div>
      )}
      {noticeId && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="font-semibold">{t("example")}</div>
          <div className="overflow-x-scroll whitespace-pre rounded-xl bg-opacityLight p-3 font-mono text-red-700 dark:bg-opacityDark dark:text-red-400">
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

      {!navigator.serviceWorker && (
        <div className="absolute left-0 top-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-bgLight/90 backdrop-blur-sm dark:bg-bgDark/90 dark:text-textDark">
          <div className="text-2xl">🤕</div>
          <div>{t("notSupported")}</div>
        </div>
      )}
    </div>
  );
}
