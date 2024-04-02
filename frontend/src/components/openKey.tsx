import rote from "@/pages/mine/home/rote";
import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import { Modal, Popover } from "antd";
import { useState } from "react";
import toast from "react-hot-toast";
import OpenKeyEditModel from "./openKeyEditModel";
import { apiDeleteOneMyOpenKey } from "@/api/rote/main";
import { useOpenKeysDispatch } from "@/state/openKeys";

function OpenKeyItem({ openKey }: any) {
  const [open, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const openKeysDispatch = useOpenKeysDispatch();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  function actionsMenu(rote: any) {
    function deleteOpenKey() {
      setOpen(false);
      const toastId = toast.loading("删除中...");
      apiDeleteOneMyOpenKey(openKey.id)
        .then((res) => {
          toast.success("删除成功", {
            id: toastId,
          });
          openKeysDispatch({
            type: "delete",
            openKeyid: res.data.data.id,
          });
        })
        .catch((err) => {
          toast.error("删除失败", {
            id: toastId,
          });
        });
    }

    return (
      <div className=" flex flex-col">
        <div
          className=" py-1 px-2 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={() => {
            setOpen(false);
            setIsModalOpen(true);
            // setEditRote(rote);
          }}
        >
          <EditOutlined />
          编辑
        </div>
        <div
          className=" py-1 px-2 text-red-500 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={deleteOpenKey}
        >
          <DeleteOutlined />
          删除
        </div>
      </div>
    );
  }

  function onModelCancel() {
    setIsModalOpen(false);
    // setEditRote({});
  }

  return (
    <div
      className=" opacity-0 translate-y-5 animate-show cursor-pointer duration-300 p-4 bg-white border-[#00000010] border-t-[1px]"
    >
      <div className=" flex items-center break-all mr-auto font-semibold font-mono">
        {openKey.id.slice(0, 4) + "****************" + openKey.id.slice(-4)}

        <Popover
          placement="bottomRight"
          open={open}
          onOpenChange={handleOpenChange}
          content={actionsMenu(rote)}
        >
          <EllipsisOutlined className=" ml-auto hover:bg-[#00000010] rounded-full p-2" />
        </Popover>
      </div>
      <div className=" ">权限：{openKey.permissions}</div>

      <Modal
        title="OpenKey"
        open={isModalOpen}
        onCancel={onModelCancel}
        maskClosable={true}
        destroyOnClose={true}
        footer={null}
      >
        <OpenKeyEditModel openKey={openKey}></OpenKeyEditModel>
      </Modal>
    </div>
  );
}

export default OpenKeyItem;
