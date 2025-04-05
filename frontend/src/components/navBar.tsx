import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

export default function NavBar() {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.navBar",
  });
  let location = useLocation();
  const navigate = useNavigate();

  function back() {
    const doesAnyHistoryEntryExist = location.key !== "default";
    if (doesAnyHistoryEntryExist) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  }
  return (
    <>
      <div
        className={` duration-300 fixed top-0 z-10 w-full border border-b overflow-x-scroll noScrollBar items-center bg-bgLight/90 dark:bg-bgDark/90 backdrop-blur-xl py-3   ${
          window.history.state && window.history.state.idx > 0
            ? "flex"
            : "hidden"
        }`}
      >
        <ArrowLeft className=" p-2 size-8 cursor-pointer" onClick={back} />
        <div className=" text-base cursor-pointer" onClick={back}>
          {t("back")}
        </div>
      </div>
      <div className="h-14"></div>
    </>
  );
}
