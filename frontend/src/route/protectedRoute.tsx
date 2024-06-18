import { useProfile } from "@/state/profile";
import { Navigate } from "react-router-dom";
import MobileDetect from "mobile-detect";
import toast from "react-hot-toast";
import { useEffect } from "react";

export const ProtectedRoute = ({ children }: any) => {
  const profile = useProfile();
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
    if (window.localStorage.getItem("iosSafariToast") === "true") {
      return;
    }
    if (!isIosSafari()) {
      toast("iOS Safari 建议添加到桌面，体验更佳！", {
        icon: "🤖",
      });
      window.localStorage.setItem("iosSafariToast", "true");
    }
  }, []);

  if (!profile) {
    return <Navigate to="/login" />;
  }
  return children;
};
