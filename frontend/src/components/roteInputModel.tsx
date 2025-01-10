import { apiDeleteMyAttachment, apiUploadFiles } from "@/api/rote/main";
import defaultImage from "@/assets/img/defaultImage.svg";
import mainJson from "@/json/main.json";
import { useTempState } from "@/state/others";
import { useTags } from "@/state/tags";
import { Attachment, Rote } from "@/types/main";
import {
  CloseOutlined,
  GlobalOutlined,
  InboxOutlined,
  PushpinOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Image, Select, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Uploader from "./uploader";

const { roteMaxLetter } = mainJson;

function RoteInputModel({ rote, submitEdit }: { rote: Rote; submitEdit: any }) {
  const { t, i18n } = useTranslation("translation", {
    keyPrefix: "components.roteInputModel",
  });
  const [tempState, setTempState] = useTempState();
  const [tagsShow, setTagsShow] = useState(false);
  const [tags] = useTags();
  const [editType, setEditType] = useState("default");

  const [newRote, setNewRote] = useState<Rote>({
    content: "",
    tags: [],
    attachments: [],
    pin: false,
    archived: false,
    state: "public",
    id: "",
    createdAt: "",
    updatedAt: "",
  });

  const handleTagsChange = (value: string[]) => {
    setNewRote({
      ...newRote,
      tags: value.map((tag) => {
        return tag.trim();
      }),
    });
  };

  useEffect(() => {
    setNewRote(rote);
    setTagsShow(rote.tags.length > 0 ? true : false);
  }, [rote]);

  function addRoteFn() {
    if (!newRote.content.trim() && rote.attachments.length === 0) {
      toast.error(t("error.emptyContent"));
      return;
    }
    submitEdit(newRote);
  }

  function handleNormalINputKeyDown(e: any) {
    if (e.key === "Enter" && e.ctrlKey) {
      addRoteFn();
    }
  }

  function deleteFile(indexToRemove: number) {
    let toastId = toast.loading(t("deleting"));
    apiDeleteMyAttachment({
      id: newRote.attachments[indexToRemove].id,
      authorid: newRote.authorid,
    }).then((res) => {
      if (res.data.code === 0) {
        toast.success(t("deleteSuccess"), {
          id: toastId,
        });
        const updatedRote = {
          ...newRote,
          attachments: newRote.attachments.filter(
            (_: any, index: number) => index !== indexToRemove
          ),
        };
        setNewRote(updatedRote);
        setTempState({
          ...tempState,
          editOne: updatedRote,
        });
      } else {
        toast.error(t("deleteFailed"), {
          id: toastId,
        });
      }
    });
  }

  function uploadMoreFiles(newFileList: File[]) {
    let toastId = toast.loading(t("uploading"));
    let formData = new FormData();
    newFileList.forEach((file: File) => {
      formData.append("images", file);
    });

    apiUploadFiles(formData, newRote.id).then((res) => {
      if (res.data.code === 0) {
        toast.success(t("uploadSuccess"), {
          id: toastId,
        });
        let updatedRote = {
          ...newRote,
          attachments: newRote.attachments.concat(res.data.data),
        };
        setNewRote(updatedRote);
        setTempState({
          ...tempState,
          editOne: updatedRote,
        });
      }
    });
  }

  return (
    <div className=" cursor-default w-full flex gap-5">
      <div className=" w-[90%] flex-1">
        <TextArea
          variant="borderless"
          value={newRote.content}
          placeholder={t("contentPlaceholder")}
          autoSize={{ minRows: 3, maxRows: 8 }}
          className={` text-base lg:text-lg text-pretty ${
            editType === "default" ? "" : " hidden"
          }`}
          maxLength={roteMaxLetter}
          onInput={(e) => {
            setNewRote({
              ...newRote,
              content: e.currentTarget.value,
            });
          }}
          onKeyDown={handleNormalINputKeyDown}
        />

        {process.env.REACT_APP_ALLOW_UPLOAD_FILE === "true" && (
          <div className=" flex gap-2 flex-wrap my-2">
            <Image.PreviewGroup
              preview={{
                onChange: () => {},
              }}
              items={newRote.attachments.map((file: Attachment) => {
                return file.url;
              })}
            >
              {newRote.attachments.map((file: Attachment, index: number) => {
                return (
                  <div
                    className=" w-20 h-20 rounded-lg bg-bgLight overflow-hidden relative"
                    key={file.url}
                  >
                    <Image
                      className=" w-full h-full object-cover"
                      height={80}
                      width={80}
                      src={file.compressUrl}
                      fallback={defaultImage}
                    />
                    <div
                      onClick={() => deleteFile(index)}
                      className=" cursor-pointer duration-300 bg-[#00000080] rounded-md hover:scale-95 flex justify-center items-center p-2 absolute right-1 top-1 backdrop-blur-3xl"
                    >
                      <CloseOutlined className=" text-white text-[12px]" />
                    </div>
                  </div>
                );
              })}
            </Image.PreviewGroup>
            <Uploader
              id="roteInputModel"
              fileList={newRote.attachments}
              callback={(newFileList: File[]) => {
                uploadMoreFiles(newFileList);
              }}
            />
          </div>
        )}
        <Select
          mode="tags"
          variant="borderless"
          className={` bg-opacityLight dark:bg-opacityDark my-2 rounded-md border border-opacityLight dark:border-opacityDark  w-fit min-w-40 max-w-full `}
          value={newRote.tags}
          placeholder={t("tagsPlaceholder")}
          onChange={handleTagsChange}
          options={tags}
        />
        <div className=" flex flex-wrap gap-2 overflow-x-scroll noScrollBar">
          {/* <CloudUploadOutlined className=" cursor-pointer text-xl p-2 hover:bg-opacityLight dark:bg-opacityDark rounded-md" /> */}
          <Tooltip placement="bottom" title={t("pin")}>
            <PushpinOutlined
              className={` cursor-pointer text-xl p-2 rounded-md ${
                newRote.pin ? "bg-opacityLight dark:bg-opacityDark" : ""
              }`}
              onClick={() => {
                setNewRote({
                  ...newRote,
                  pin: !newRote.pin,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t("archive")}>
            <InboxOutlined
              className={` cursor-pointer text-xl p-2 rounded-md ${
                newRote.archived ? "bg-opacityLight dark:bg-opacityDark" : ""
              }`}
              onClick={() => {
                setNewRote({
                  ...newRote,
                  archived: !newRote.archived,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t(`stateOptions.${rote.state}`)}>
            <GlobalOutlined
              className={` duration-300 cursor-pointer text-lg p-2 rounded-md ${
                newRote.state === "public"
                  ? "bg-opacityLight dark:bg-opacityDark text-primary"
                  : ""
              }`}
              onClick={() => {
                setNewRote({
                  ...newRote,
                  state: newRote.state === "public" ? "private" : "public",
                });
              }}
            />
          </Tooltip>

          <div
            className=" cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-bgDark text-textDark dark:bg-bgLight dark:text-textLight px-4 py-1 rounded-md active:scale-95"
            onClick={addRoteFn}
          >
            <SendOutlined />
            {t("send")}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoteInputModel;
