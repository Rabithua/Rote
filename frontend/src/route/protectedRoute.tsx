import { useIosSafariToastDone } from "@/state/iosSafariToastDone";
import { useProfileLoadable } from "@/state/profile";
import { LoadingOutlined } from "@ant-design/icons";
import MobileDetect from "mobile-detect";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: any) => {
  const profile = useProfileLoadable();

  const [isLoading, setIsLoading] = useState(true);

  const [iosSafariToastDone, setIosSafariToastDone] = useIosSafariToastDone();

  const isIosSafari = () => {
    const md = new MobileDetect(window.navigator.userAgent);
    return md.os() === "iOS" && md.userAgent() === "Safari";
  };

  const isPwa = () => {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      ("serviceWorker" in navigator &&
        navigator.serviceWorker.controller !== null)
    );
  };

  useEffect(() => {
    if (isPwa()) {
      return;
    }
    if (iosSafariToastDone) {
      return;
    }
    if (!isIosSafari()) {
      toast("iOS Safari 建议添加到桌面，体验更佳！", {
        icon: "🤖",
      });
      setIosSafariToastDone(true);
    }
  }, []);

  useEffect(() => {
    if (profile.state !== "loading") {
      setIsLoading(false);
    }
  }, [profile]);

  return isLoading ? (
    <div className="h-screen w-screen flex items-center justify-center">
      <LoadingOutlined className="text-2xl" />
    </div>
  ) : profile.state === "hasData" && profile.data ? (
    children
  ) : (
    <Navigate to="/login" />
  );
};
