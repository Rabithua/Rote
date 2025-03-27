import { apiAddRote, apiGetMyTags, apiUploadFiles } from "@/api/rote/main";
import { getMyProfile } from "@/api/user/main";
import defaultImage from "@/assets/img/defaultImage.svg";
import Uploader from "@/components/uploader";
import mainJson from "@/json/main.json";
import { useEditor } from "@/state/editor";
import { useTempState } from "@/state/others";
import { Profile } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";

import { Avatar, Image, Select, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import { cloneDeep } from "lodash";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Archive, Globe2, PinIcon, Send, User, X } from "lucide-react";

const { roteMaxLetter } = mainJson;

function RoteInputSimple() {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.roteInputSimple",
  });

  const [tempState, setTempState] = useTempState();

  const { data: profile } = useAPIGet<Profile>(
    "profile",
    getMyProfile,
  );

  const { data: tags } = useAPIGet<string[]>(
    "tags",
    apiGetMyTags,
  );

  const [fileList, setFileList] = useState([]) as any;
  const [editType] = useState("default");

  const [rote, setRote] = useEditor();

  const handleTagsChange = (value: string[]) => {
    setRote({
      ...rote,
      tags: value.map((tag) => {
        return tag.trim();
      }),
    });
  };

  function deleteFile(indexToRemove: number) {
    setFileList(
      fileList.filter((_: any, index: number) => index !== indexToRemove),
    );
  }

  async function addRoteFn() {
    if (!rote.content.trim() && fileList.length === 0) {
      toast.error(t("error.emptyContent"));
      return;
    }

    const newFileList = cloneDeep(fileList);
    const toastId = toast.loading(t("sending"));

    apiAddRote({
      ...rote,
      attachments: fileList.length > 0 ? true : false,
      content: rote.content.trim(),
    })
      .then(async (res) => {
        toast.success(t("sendSuccess"), {
          id: toastId,
        });
        await uploadAttachments(newFileList, res.data.data);
      })
      .catch(() => {
        toast.error(t("sendFailed"), {
          id: toastId,
        });
      });

    setFileList([]);
    setRote({
      content: "",
      type: "rote",
      tags: [],
      state: "private",
      archived: false,
      pin: false,
    });
  }

  function uploadAttachments(fileList: any, rote: any) {
    if (fileList.length === 0) {
      return [];
    }
    return new Promise((reslove, reject) => {
      const toastId = toast.loading(t("uploading"));
      try {
        const formData = new FormData();
        fileList.forEach((file: any) => {
          formData.append("images", file);
        });
        apiUploadFiles(formData, rote.id).then((res) => {
          if (res.data.code !== 0) return;
          toast.success(t("uploadSuccess"), {
            id: toastId,
          });
          setTempState({
            ...tempState,
            newAttachments: res.data.data,
          });
          reslove(res);
        });
      } catch (error) {
        toast.error(t("uploadFailed"), {
          id: toastId,
        });
        console.error("Error uploading image:", error);
        reject();
      }
    });
  }

  function handleNormalINputKeyDown(e: any) {
    if (e.key === "Enter" && e.ctrlKey) {
      addRoteFn();
    }
  }

  function handlePaste(e: any) {
    const items = e.clipboardData?.items;

    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          // 创建一个新的 File 对象
          const file = new File([blob], `pasted-image-${Date.now()}.png`, {
            type: "image/png",
          });

          setFileList([...fileList, { file, src: URL.createObjectURL(file) }]);
        }
      }
    }
  }

  function handleDrop<T extends HTMLElement>(e: React.DragEvent<T>) {
    e.preventDefault();
    const files = e.dataTransfer.files;

    if (files.length > 0) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          setFileList((prevFileList: any) => [
            ...prevFileList,
            { file, src: URL.createObjectURL(file) },
          ]);
        } else {
          console.warn(`File ${file.name} is not an image and was skipped.`);
        }
      });
    }
  }

  return (
    <div className=" cursor-default bg-bgLight dark:bg-bgDark w-full p-5 flex gap-5 border-b border-opacityLight dark:border-opacityDark">
      <Avatar
        className=" bg-opacityLight dark:bg-opacityDark text-black shrink-0 hidden sm:block"
        size={{ xs: 24, sm: 32, md: 40, lg: 50, xl: 50, xxl: 50 }}
        icon={<User className=" text-[#00000030]" />}
        src={profile?.avatar}
      />
      <div className=" w-[90%] flex-1">
        <TextArea
          variant="borderless"
          value={rote.content}
          placeholder={t("contentPlaceholder")}
          autoSize={{ minRows: 3, maxRows: 10 }}
          className={` text-base lg:text-lg text-pretty ${
            editType === "default" ? "" : " hidden"
          }`}
          maxLength={roteMaxLetter}
          onInput={(e) => {
            setRote({
              ...rote,
              content: e.currentTarget.value,
            });
          }}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onKeyDown={handleNormalINputKeyDown}
        />
        {process.env.REACT_APP_ALLOW_UPLOAD_FILE === "true" && (
          <div className=" flex gap-2 flex-wrap my-2">
            <Image.PreviewGroup
              preview={{
                onChange: () => {},
              }}
            >
              {fileList.map((file: File, index: number) => {
                return (
                  <div
                    className=" w-20 h-20 rounded-lg bg-bgLight overflow-hidden relative"
                    key={file.name + index}
                  >
                    <Image
                      className=" w-full h-full object-cover"
                      height={80}
                      width={80}
                      src={URL.createObjectURL(file)}
                      fallback={defaultImage}
                    />
                    <div
                      onClick={() => deleteFile(index)}
                      className=" cursor-pointer duration-300 bg-[#00000080] rounded-md hover:scale-95 flex justify-center items-center p-2 absolute right-1 top-1 backdrop-blur-3xl"
                    >
                      <X className=" text-white size-4" />
                    </div>
                  </div>
                );
              })}
            </Image.PreviewGroup>
            <Uploader
              id="roteInputSimple"
              fileList={fileList}
              callback={(newFileList: File[]) => {
                setFileList((prevFileList: any) => [
                  ...prevFileList,
                  ...newFileList,
                ]);
              }}
            />
          </div>
        )}

        <Select
          mode="tags"
          variant="borderless"
          className={` bg-opacityLight dark:bg-opacityDark my-2 rounded-md border border-opacityLight dark:border-opacityDark w-fit min-w-40 max-w-full `}
          value={rote.tags}
          placeholder={t("tagsPlaceholder")}
          onChange={handleTagsChange}
          options={tags
            ? tags.map((tag) => {
              return {
                value: tag,
                label: tag,
              };
            })
            : []}
        />
        <div className=" flex flex-wrap gap-2 overflow-x-scroll noScrollBar">
          <Tooltip placement="bottom" title={t("pin")}>
            <PinIcon
              className={` duration-300 cursor-pointer size-8 p-2 rounded-md  ${
                rote.pin ? "bg-opacityLight dark:bg-opacityDark" : ""
              }`}
              onClick={() => {
                setRote({
                  ...rote,
                  pin: !rote.pin,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t("archive")}>
            <Archive
              className={` duration-300 cursor-pointer size-8 p-2 rounded-md ${
                rote.archived ? "bg-opacityLight dark:bg-opacityDark" : ""
              }`}
              onClick={() => {
                setRote({
                  ...rote,
                  archived: !rote.archived,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t(`stateOptions.${rote.state}`)}>
            <Globe2
              className={` duration-300 cursor-pointer size-8 p-2 rounded-md ${
                rote.state === "public"
                  ? "bg-opacityLight dark:bg-opacityDark text-primary"
                  : ""
              }`}
              onClick={() => {
                setRote({
                  ...rote,
                  state: rote.state === "public" ? "private" : "public",
                });
              }}
            />
          </Tooltip>

          <div
            className=" cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-bgDark text-textDark dark:bg-bgLight dark:text-textLight px-4 py-1 rounded-md active:scale-95"
            onClick={addRoteFn}
          >
            <Send className="size-4" />
            {t("send")}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoteInputSimple;
