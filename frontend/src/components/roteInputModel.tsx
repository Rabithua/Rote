import { Select, Tooltip } from "antd";
import {
  InboxOutlined,
  PushpinOutlined,
  SendOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import mainJson from "@/json/main.json";
import toast from "react-hot-toast";
import { useTags } from "@/state/tags";
const { stateOptions, roteMaxLetter } = mainJson;

function RoteInputModel({ rote, submitEdit }: any) {
  const [tagsShow, setTagsShow] = useState(false);
  const tags = useTags();
  const [editType, setEditType] = useState("default");

  const [newRote, setNewRote] = useState<any>({
    title: "",
    content: "",
    type: "rote",
    tags: [],
    state: "private",
    pin: false,
  });

  const handleTagsChange = (value: string[]) => {
    setNewRote({
      ...newRote,
      tags: value.map((tag) => {
        return tag.trim();
      }),
    });
  };

  const handleStateChange = (value: string) => {
    setNewRote({
      ...newRote,
      state: value,
    });
  };

  useEffect(() => {
    setNewRote(rote);
    setTagsShow(rote.tags.length > 0 ? true : false);
  }, [rote]);

  function addRoteFn() {
    if (!newRote.content.trim()) {
      toast.error("内容不能为空");
      return;
    }
    submitEdit(newRote);
  }

  function handleNormalINputKeyDown(e: any) {
    if (e.key === "Enter" && e.ctrlKey) {
      addRoteFn();
    }
  }

  return (
    <div className=" cursor-default bg-white w-full flex gap-5">
      <div className=" w-[90%] flex-1">
        <TextArea
          variant="borderless"
          value={newRote.content}
          placeholder="Ctrl + ↵ 发送"
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

        <Select
          mode="tags"
          variant="borderless"
          className={` bg-[#00000005] my-2 rounded-md border border-[#00000010] w-fit min-w-40 max-w-full ${
            tagsShow ? "" : "hidden"
          }`}
          value={newRote.tags}
          placeholder="标签"
          onChange={handleTagsChange}
          options={tags}
        />
        <div className=" flex flex-wrap gap-2 overflow-x-scroll noScrollBar">
          <Tooltip placement="bottom" title={"标签"}>
            <TagsOutlined
              onClick={() => {
                setTagsShow(!tagsShow);
              }}
              className={` cursor-pointer text-xl p-2 hover:bg-[#00000005] rounded-md ${
                tagsShow ? " bg-[#00000010]" : ""
              }`}
            />
          </Tooltip>
          {/* <CloudUploadOutlined className=" cursor-pointer text-xl p-2 hover:bg-[#00000010] rounded-md" /> */}
          <Tooltip placement="bottom" title={"置顶"}>
            <PushpinOutlined
              className={` cursor-pointer text-xl p-2 rounded-md ${
                newRote.pin ? "bg-[#00000010]" : ""
              }`}
              onClick={() => {
                setNewRote({
                  ...newRote,
                  pin: !newRote.pin,
                });
              }}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={"归档"}>
            <InboxOutlined
              className={` cursor-pointer text-xl p-2 rounded-md ${
                newRote.archived ? "bg-[#00000010]" : ""
              }`}
              onClick={() => {
                setNewRote({
                  ...newRote,
                  archived: !newRote.archived,
                });
              }}
            />
          </Tooltip>
          <Select
            defaultValue="私密"
            variant="borderless"
            style={{ width: 80 }}
            className=" hover:bg-[#00000010] rounded-md"
            onChange={handleStateChange}
            options={stateOptions}
          />
          <div
            className=" cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95"
            onClick={addRoteFn}
          >
            <SendOutlined />
            发送
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoteInputModel;
