import { LeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
      {window.history.state && window.history.state.idx > 0 && (
        <div className=" duration-300 sticky top-0 z-10 w-full flex overflow-x-scroll noScrollBar items-center bg-bgLight/90 dark:bg-bgDark/90 backdrop-blur-xl">
          <LeftOutlined className=" p-4 cursor-pointer" onClick={back} />
          <div className=" font-semibold cursor-pointer" onClick={back}>
            {t("back")}
          </div>
        </div>
      )}
    </>
  );
}
