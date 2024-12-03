import { apiAddRote, apiUploadFiles } from "@/api/rote/main";
import defaultImage from "@/assets/img/defaultImage.svg";
import Uploader from "@/components/uploader";
import mainJson from "@/json/main.json";
import { useProfile } from "@/state/profile";
import { useRotesDispatch } from "@/state/rotes";
import { useTags } from "@/state/tags";
import {
  CloseOutlined,
  InboxOutlined,
  PushpinOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Image, Select, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import { cloneDeep } from "lodash";
import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

const { roteMaxLetter } = mainJson;

function RoteInputSimple() {
  const { t, i18n } = useTranslation("translation", {
    keyPrefix: "components.roteInputSimple",
  });
  const tags = useTags();
  const [fileList, setFileList] = useState([]) as any;
  const [editType, setEditType] = useState("default");
  const profile = useProfile();

  const [rote, setRote] = useState<any>({
    title: "",
    content: "",
    type: "rote",
    tags: [],
    state: "private",
    archived: false,
    pin: false,
  });
  const rotesDispatch = useRotesDispatch();

  const handleTagsChange = (value: string[]) => {
    setRote({
      ...rote,
      tags: value.map((tag) => {
        return tag.trim();
      }),
    });
  };

  const handleStateChange = (value: string) => {
    setRote({
      ...rote,
      state: value,
    });
  };

  function changeEditType() {
    setEditType(editType === "default" ? "novel" : "default");
  }

  function deleteFile(indexToRemove: number) {
    setFileList(
      fileList.filter((_: any, index: number) => index !== indexToRemove)
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
        if (!res.data.data.archived) {
          rotesDispatch({
            type: "addOne",
            rote: res.data.data,
          });
        }
        toast.success(t("sendSuccess"), {
          id: toastId,
        });

        let attachments = await uploadAttachments(newFileList, res.data.data);
      })
      .catch((err) => {
        toast.error(t("sendFailed"), {
          id: toastId,
        });
      });

    setFileList([]);
    setRote({
      title: "",
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
        fileList.forEach((obj: any) => {
          formData.append("images", obj.file);
        });
        apiUploadFiles(formData, rote.id).then((res) => {
          toast.success(t("uploadSuccess"), {
            id: toastId,
          });
          rotesDispatch({
            type: "updateOne",
            rote: {
              ...rote,
              attachments: res.data.data,
            },
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

  const processedStateOptions = useMemo(
    () =>
      mainJson.stateOptions.map((option) => ({
        ...option,
        label: option.label[i18n.language as keyof typeof option.label],
        options: option.options.map((subOption) => ({
          ...subOption,
          label: subOption.label[i18n.language as keyof typeof option.label],
        })),
      })),
    [i18n.language]
  );

  return (
    <div className=" cursor-default bg-bgLight dark:bg-bgDark w-full p-5 flex gap-5 border-b border-opacityLight dark:border-opacityDark">
      <Avatar
        className=" bg-opacityLight dark:bg-opacityDark text-black shrink-0 hidden sm:block"
        size={{ xs: 24, sm: 32, md: 40, lg: 50, xl: 50, xxl: 50 }}
        icon={<UserOutlined className=" text-[#00000030]" />}
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
                onChange: (current, prev) => {},
              }}
            >
              {fileList.map((file: any, index: number) => {
                return (
                  <div
                    className=" w-20 h-20 rounded-lg bg-bgLight overflow-hidden relative"
                    key={`filePicker_${index}`}
                  >
                    <Image
                      className=" w-full h-full object-cover"
                      height={80}
                      width={80}
                      src={file.src}
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
            <Uploader fileList={fileList} setFileList={setFileList} />
          </div>
        )}

        <Select
          mode="tags"
          variant="borderless"
          className={` bg-opacityLight dark:bg-opacityDark my-2 rounded-md border border-opacityLight dark:border-opacityDark w-fit min-w-40 max-w-full `}
          value={rote.tags}
          placeholder={t("tagsPlaceholder")}
          onChange={handleTagsChange}
          options={tags}
        />
        <div className=" flex flex-wrap gap-2 overflow-x-scroll noScrollBar">
          <Tooltip placement="bottom" title={t("pin")}>
            <PushpinOutlined
              className={` cursor-pointer text-xl p-2 rounded-md  ${
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
            <InboxOutlined
              className={` cursor-pointer text-xl p-2 rounded-md ${
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
          <Select
            defaultValue={t("stateOptions.private")}
            variant="borderless"
            style={{ width: 80 }}
            className=" bg-opacityLight min-w-32 dark:bg-opacityDark rounded-md"
            onChange={handleStateChange}
            options={processedStateOptions}
          />

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

export default RoteInputSimple;
