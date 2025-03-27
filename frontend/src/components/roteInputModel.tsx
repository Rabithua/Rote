import {
  apiDeleteMyAttachment,
  apiGetMyTags,
  apiUploadFiles,
} from "@/api/rote/main";
import defaultImage from "@/assets/img/defaultImage.svg";
import mainJson from "@/json/main.json";
import { Attachment, Rote, Rotes } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { Image, Select, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Uploader from "./uploader";
import { SWRInfiniteKeyedMutator } from "swr/dist/infinite";
import { Archive, Globe2, Pin, Send, X } from "lucide-react";

const { roteMaxLetter } = mainJson;

function RoteInputModel(
  { rote, submitEdit, mutate }: {
    rote: Rote;
    submitEdit: any;
    mutate?: SWRInfiniteKeyedMutator<Rotes>;
  },
) {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.roteInputModel",
  });

  const { data: tags } = useAPIGet<string[]>(
    "tags",
    apiGetMyTags,
  );

  const [, setTagsShow] = useState(false);

  const [editType] = useState("default");

  const [tempRote, setTempRote] = useState<Rote>({
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
    setTempRote({
      ...tempRote,
      tags: value.map((tag) => {
        return tag.trim();
      }),
    });
  };

  useEffect(() => {
    setTempRote(rote);
    setTagsShow(rote.tags.length > 0 ? true : false);
  }, [rote]);

  function addRoteFn() {
    if (!tempRote.content.trim() && rote.attachments.length === 0) {
      toast.error(t("error.emptyContent"));
      return;
    }
    submitEdit(tempRote);
  }

  function handleNormalINputKeyDown(e: any) {
    if (e.key === "Enter" && e.ctrlKey) {
      addRoteFn();
    }
  }

  function deleteFile(indexToRemove: number) {
    let toastId = toast.loading(t("deleting"));
    apiDeleteMyAttachment({
      id: tempRote.attachments[indexToRemove].id,
      authorid: tempRote.authorid,
    }).then((res) => {
      if (res.data.code === 0) {
        toast.success(t("deleteSuccess"), {
          id: toastId,
        });
        const updatedRote = {
          ...tempRote,
          attachments: tempRote.attachments.filter(
            (_: any, index: number) => index !== indexToRemove,
          ),
        };
        setTempRote(updatedRote);

        mutate && mutate(
          (currentData) => {
            return currentData?.map((page) => {
              if (Array.isArray(page)) {
                return page.map((r) =>
                  r.id === rote.id ? updatedRote : r
                ) as Rote[];
              }
              return page;
            }) as Rotes;
          },
          {
            revalidate: false,
          },
        );
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

    apiUploadFiles(formData, tempRote.id).then((res) => {
      if (res.data.code === 0) {
        toast.success(t("uploadSuccess"), {
          id: toastId,
        });
        let updatedRote = {
          ...tempRote,
          attachments: tempRote.attachments.concat(res.data.data),
        };
        setTempRote(updatedRote);

        mutate && mutate(
          (currentData) => {
            return currentData?.map((page) => {
              if (Array.isArray(page)) {
                return page.map((r) =>
                  r.id === rote.id ? updatedRote : r
                ) as Rote[];
              }
              return page;
            }) as Rotes;
          },
          {
            revalidate: false,
          },
        );
      }
    });
  }

  return (
    <div className=" cursor-default w-full flex gap-5">
      <div className=" w-[90%] flex-1">
        <TextArea
          variant="borderless"
          value={tempRote.content}
          placeholder={t("contentPlaceholder")}
          autoSize={{ minRows: 3, maxRows: 8 }}
          className={` text-base lg:text-lg text-pretty ${
            editType === "default" ? "" : " hidden"
          }`}
          maxLength={roteMaxLetter}
          onInput={(e) => {
            setTempRote({
              ...tempRote,
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
              items={tempRote.attachments.map((file: Attachment) => {
                return file.url;
              })}
            >
              {tempRote.attachments.map((file: Attachment, index: number) => {
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
                      <X className=" text-white size-4" />
                    </div>
                  </div>
                );
              })}
            </Image.PreviewGroup>
            <Uploader
              id="roteInputModel"
              fileList={tempRote.attachments}
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
          value={tempRote.tags}
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
          {/* <CloudUploadOutlined className=" cursor-pointer text-xl p-2 hover:bg-opacityLight dark:bg-opacityDark rounded-md" /> */}
          <Tooltip placement="bottom" title={t("pin")}>
            <Pin
              className={` cursor-pointer size-8 p-2 rounded-md ${
                tempRote.pin ? "bg-opacityLight dark:bg-opacityDark" : ""
              }`}
              onClick={() => {
                setTempRote({
                  ...tempRote,
                  pin: !tempRote.pin,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t("archive")}>
            <Archive
              className={` cursor-pointer size-8 p-2 rounded-md ${
                tempRote.archived ? "bg-opacityLight dark:bg-opacityDark" : ""
              }`}
              onClick={() => {
                setTempRote({
                  ...tempRote,
                  archived: !tempRote.archived,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t(`stateOptions.${rote.state}`)}>
            <Globe2
              className={` duration-300 cursor-pointer size-8 p-2 rounded-md ${
                tempRote.state === "public"
                  ? "bg-opacityLight dark:bg-opacityDark text-primary"
                  : ""
              }`}
              onClick={() => {
                setTempRote({
                  ...tempRote,
                  state: tempRote.state === "public" ? "private" : "public",
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

export default RoteInputModel;
