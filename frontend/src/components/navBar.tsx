import { LeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";

export default function NavBar() {
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
        <div className=" duration-300 sticky top-0 z-10 w-full flex overflow-x-scroll noScrollBar items-center bg-[#ffffff99] backdrop-blur-xl">
          <LeftOutlined className=" p-4 cursor-pointer" onClick={back} />
          <div className=" font-semibold cursor-pointer" onClick={back}>
            返回
          </div>
        </div>
      )}
    </>
  );
}
