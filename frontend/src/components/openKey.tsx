import rote from "@/pages/home";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { Modal, Popover } from "antd";
import { useState } from "react";
import toast from "react-hot-toast";
import OpenKeyEditModel from "./openKeyEditModel";
import { apiDeleteOneMyOpenKey } from "@/api/rote/main";
import { useOpenKeys } from "@/state/openKeys";
import { useTranslation } from "react-i18next";

function OpenKeyItem({ openKey }: any) {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.openKey",
  });
  const [open, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [openKeys, setOpenKeys] = useOpenKeys();
  const [hidekey, setHideKey] = useState(true);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  function actionsMenu(rote: any) {
    function deleteOpenKey() {
      setOpen(false);
      const toastId = toast.loading(t("deleting"));
      apiDeleteOneMyOpenKey(openKey.id)
        .then((res) => {
          toast.success(t("deleteSuccess"), {
            id: toastId,
          });
          setOpenKeys(openKeys.filter((key) => key.id !== res.data.data.id));
        })
        .catch((err) => {
          toast.error(t("deleteFailed"), {
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
          {t("edit")}
        </div>
        <div
          className=" py-1 px-2 text-red-500 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={deleteOpenKey}
        >
          <DeleteOutlined />
          {t("delete")}
        </div>
      </div>
    );
  }

  function onModelCancel() {
    setIsModalOpen(false);
    // setEditRote({});
  }

  function changeHideKey() {
    setHideKey(!hidekey);
  }

  async function copyToClipboard(): Promise<void> {
    const text = `${
      process.env.REACT_APP_BASEURL_PRD || "http://localhost:3000"
    }/v1/api/openkey/onerote?openkey=${
      openKey.id
    }&content=这是一条使用OpenKey发送的笔记。&tag=FromOpenKey&tag=标签二&state=private`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copySuccess"));
    } catch (err) {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className=" opacity-0 translate-y-5 animate-show cursor-pointer duration-300 p-4 bg-bgLight dark:bg-bgDark  border-t-[1px] border-opacityLight dark:border-opacityDark">
      <div className=" flex items-center break-all mr-auto font-semibold font-mono">
        {hidekey
          ? `${openKey.id.slice(0, 4)}****************${openKey.id.slice(-4)}`
          : openKey.id}
        {hidekey ? (
          <EyeOutlined
            onClick={changeHideKey}
            className=" ml-1 hover:bg-[#00000010] rounded-full p-2"
          />
        ) : (
          <EyeInvisibleOutlined
            onClick={changeHideKey}
            className=" ml-1 hover:bg-[#00000010] rounded-full p-2"
          />
        )}
        <Popover
          placement="bottomRight"
          open={open}
          onOpenChange={handleOpenChange}
          content={actionsMenu(rote)}
        >
          <EllipsisOutlined className=" ml-auto hover:bg-[#00000010] rounded-full p-2" />
        </Popover>
      </div>
      <div className="">
        {t("permissions")}：{openKey.permissions.join(",")}
      </div>
      <div className="">
        {t("example")}：
        <span className=" font-mono break-all">
          {process.env.REACT_APP_BASEURL_PRD || "http://localhost:3000"}
          /v1/api/openkey/onerote?openkey=
          {hidekey
            ? `${openKey.id.slice(0, 4)}****************${openKey.id.slice(-4)}`
            : openKey.id}
          &content=这是一条使用OpenKey发送的笔记。&tag=FromOpenKey&tag=标签二&state=private
        </span>
        <span onClick={copyToClipboard}>
          <CopyOutlined className=" ml-auto hover:bg-[#00000010] rounded-full p-2" />
        </span>
      </div>
      <Modal
        title="OpenKey"
        open={isModalOpen}
        onCancel={onModelCancel}
        maskClosable={true}
        destroyOnClose={true}
        footer={null}
      >
        <OpenKeyEditModel
          close={onModelCancel}
          openKey={openKey}
        ></OpenKeyEditModel>
      </Modal>
    </div>
  );
}

export default OpenKeyItem;
