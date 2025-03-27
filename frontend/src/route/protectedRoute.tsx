import { getMyProfile } from "@/api/user/main";
import { useIosSafariToastDone } from "@/state/iosSafariToastDone";
import { Profile } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { Loader } from "lucide-react";
import MobileDetect from "mobile-detect";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: any) => {
  const { data: profile, isLoading } = useAPIGet<Profile>(
    "profile",
    getMyProfile,
  );

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
  }, [iosSafariToastDone, setIosSafariToastDone]);

  return isLoading
    ? (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader className="animate-spin size-6" />
      </div>
    )
    : profile
    ? children
    : <Navigate to="/login" />;
};
