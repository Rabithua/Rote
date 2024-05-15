import { SaveOutlined } from "@ant-design/icons";
import { apiGetMyRote } from "@/api/rote/main";
import {
  useArchivedRotes,
  useArchivedRotesDispatch,
} from "@/state/archivedRotes";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";
import { useEffect } from "react";

function ArchivedPage() {
  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const rotes = useArchivedRotes();
  const rotesDispatch = useArchivedRotesDispatch();

  useEffect(() => {
    return rotesDispatch({
      type: "freshAll",
      rotes: [],
    });
  }, []);

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <div className=" sticky top-0 z-10">
        <div className=" flex gap-2 bg-white text-2xl font-semibold p-4">
          <SaveOutlined />
          归档 / Archived
        </div>
      </div>
      <div id="top" className=" h-[1px]"></div>

      <RoteList
        rotes={rotes}
        rotesDispatch={rotesDispatch}
        api={apiGetMyRote}
        apiProps={{
          limit: 20,
          archived: true,
          filter: {},
        }}
      />

      <GoTop scrollContainerName="scrollContainer" />
    </div>
  );
}

export default ArchivedPage;
