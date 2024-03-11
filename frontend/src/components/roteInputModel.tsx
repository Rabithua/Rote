import { Select, SelectProps } from "antd";
import { PushpinOutlined, SendOutlined, TagsOutlined } from "@ant-design/icons";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import mainJson from "@/json/main.json";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTags } from "@/state/tags";
const { stateOptions } = mainJson;

function RoteInputModel({ rote, submitEdit }: any) {
  const navigate = useNavigate();
  const [novelValue, setNovelValue] = useState<any>("");
  const [tagsShow, setTagsShow] = useState(false);
  const tags = useTags();
  const [fileList, setFileList] = useState([]) as any;
  const [editType, setEditType] = useState("default");

  const [newRote, setNewRote] = useState<any>({
    title: "",
    content: "",
    type: "Rote",
    tags: [],
    state: "private",
    pin: false,
  });

  const handleTagsChange = (value: string) => {
    console.log(value, typeof value);
    setNewRote({
      ...newRote,
      tags: value,
    });
  };

  const handleStateChange = (value: string) => {
    console.log(`selected ${value}`);
    setNewRote({
      ...newRote,
      state: value,
    });
  };

  const [profile, setProfile] = useState<any>({});

  useEffect(() => {
    setNewRote(rote);
    setTagsShow(rote.tags.length > 0 ? true : false);
  }, [rote]);

  function deleteFile(indexToRemove: number) {
    setFileList(
      fileList.filter((_: any, index: number) => index !== indexToRemove)
    );
  }

  function addRoteFn() {
    if (!newRote.content) {
      toast.error("内容不能为空");
      return;
    }
    console.log(newRote);
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
          maxLength={3000}
          onInput={(e) => {
            setNewRote({
              ...newRote,
              content: e.currentTarget.value,
            });
          }}
          onKeyDown={handleNormalINputKeyDown}
        />
        {/* <div className=" flex gap-2 flex-wrap my-2">
                    <Image.PreviewGroup
                        preview={{
                            onChange: (current, prev) =>
                                console.log(`current index: ${current}, prev index: ${prev}`),
                        }}
                    >
                        {fileList.map((file: any, index: number) => {
                            return (
                                <div
                                    className=" w-20 h-20 rounded-lg bg-bgWhite border overflow-hidden relative"
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
                </div> */}
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
          <TagsOutlined
            onClick={() => {
              setTagsShow(!tagsShow);
            }}
            className={` cursor-pointer text-xl p-2 hover:bg-[#00000005] rounded-md ${
              tagsShow ? " bg-[#00000010]" : ""
            }`}
          />
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
          <Select
            value={newRote.state}
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
