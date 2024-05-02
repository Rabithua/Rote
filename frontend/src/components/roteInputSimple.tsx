import { Avatar, Image, Select, SelectProps } from "antd";
import { cloneDeep } from "lodash";
import {
  CloseOutlined,
  PushpinOutlined,
  SendOutlined,
  TagsOutlined,
  UserOutlined,
} from "@ant-design/icons";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import defaultImage from "@/assets/img/defaultImage.svg";
import Uploader from "@/components/uploader";
import mainJson from "@/json/main.json";
import { useNavigate } from "react-router-dom";
import { apiAddRote, apiGetMyTags, apiUploadFiles } from "@/api/rote/main";
import toast from "react-hot-toast";
import { useTags } from "@/state/tags";
import { useRotesDispatch } from "@/state/rotes";
import { useProfile } from "@/state/profile";
import { apiUploadAvatar } from "@/api/user/main";
const { stateOptions, roteMaxLetter } = mainJson;

function RoteInputSimple() {
  const navigate = useNavigate();
  const [novelValue, setNovelValue] = useState<any>("");
  const [tagsShow, setTagsShow] = useState(false);
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
    console.log(fileList);
    if (!rote.content.trim()) {
      toast.error("内容不能为空");
      return;
    }

    const newFileList = cloneDeep(fileList);
    const toastId = toast.loading("发送中...");

    apiAddRote({
      ...rote,
      content: rote.content.trim(),
    })
      .then(async (res) => {
        rotesDispatch({
          type: "addOne",
          rote: res.data.data,
        });
        toast.success("发送成功", {
          id: toastId,
        });

        let attachments = await uploadAttachments(newFileList, res.data.data);
        console.log(attachments);
      })
      .catch((err) => {
        toast.error("发送失败", {
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
      pin: false,
    });
  }

  function uploadAttachments(fileList: any, rote: any) {
    return new Promise((reslove, reject) => {
      const toastId = toast.loading("附件上传中...");
      try {
        const formData = new FormData();
        fileList.forEach((obj: any) => {
          formData.append("file", obj.file);
        });
        apiUploadFiles(formData, rote.id).then((res) => {
          console.log(res);
          toast.success("附件上传成功", {
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
        toast.error("附件上传失败", {
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

  return (
    <div className=" cursor-default bg-white w-full p-5 flex gap-5">
      <Avatar
        className=" bg-[#00000010] text-black shrink-0 hidden sm:block"
        size={{ xs: 24, sm: 32, md: 40, lg: 50, xl: 50, xxl: 50 }}
        icon={<UserOutlined className=" text-[#00000030]" />}
        src={profile?.avatar}
      />
      <div className=" w-[90%] flex-1">
        <TextArea
          variant="borderless"
          value={rote.content}
          placeholder="Ctrl + ↵ 发送"
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
          onKeyDown={handleNormalINputKeyDown}
        />
        <div className=" flex gap-2 flex-wrap my-2">
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
        </div>
        <Select
          mode="tags"
          variant="borderless"
          className={` bg-[#00000005] my-2 rounded-md border border-[#00000010] w-fit min-w-40 max-w-full ${
            tagsShow ? "" : "hidden"
          }`}
          value={rote.tags}
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
          {/* <CloudUploadOutlined className=" cursor-pointer text-xl p-2 hover:bg-[#00000010] rounded-md" /> */}
          <PushpinOutlined
            className={` cursor-pointer text-xl p-2 rounded-md ${
              rote.pin ? "bg-[#00000010]" : ""
            }`}
            onClick={() => {
              setRote({
                ...rote,
                pin: !rote.pin,
              });
            }}
          />
          <Select
            defaultValue="私密"
            variant="borderless"
            style={{ width: 80 }}
            className=" hover:bg-[#00000010] rounded-md"
            onChange={handleStateChange}
            options={stateOptions}
          />
          {/* <div
            className={` cursor-pointer hover:bg-[#00000010] duration-300 h-full w-20 flex items-center rounded-md active:scale-95 justify-center ${editType === "novel" ? " bg-[#00000010]" : ""
              }`}
            onClick={changeEditType}
          >
            <Tooltip title="Novel编辑器" placement="bottom" className="">
              <svg
                className=" flex-1 p-2 px-3"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 270 92"
                fill="none"
              >
                <path
                  d="M32.4593 0.676835C32.7674 -0.225613 34.0438 -0.225611 34.3519 0.676837L35.9198 5.26819C36.0199 5.56118 36.25 5.79131 36.543 5.89137L41.1344 7.45925C42.0368 7.76743 42.0368 9.04376 41.1343 9.35194L36.543 10.9198C36.25 11.0199 36.0199 11.25 35.9198 11.543L34.3519 16.1344C34.0438 17.0368 32.7674 17.0368 32.4593 16.1343L30.8914 11.543C30.7913 11.25 30.5612 11.0199 30.2682 10.9198L25.6768 9.35194C24.7744 9.04376 24.7744 7.76743 25.6768 7.45925L30.2682 5.89137C30.5612 5.79131 30.7913 5.56118 30.8914 5.26819L32.4593 0.676835Z"
                  fill="black"
                />
                <path
                  d="M12.4593 19.6768C12.7674 18.7744 14.0438 18.7744 14.3519 19.6768L17.1926 27.9954C17.2927 28.2884 17.5228 28.5185 17.8158 28.6186L26.1344 31.4593C27.0368 31.7674 27.0368 33.0438 26.1343 33.3519L17.8158 36.1926C17.5228 36.2927 17.2927 36.5228 17.1926 36.8158L14.3519 45.1344C14.0438 46.0368 12.7674 46.0368 12.4593 45.1343L9.61857 36.8158C9.51852 36.5228 9.28839 36.2927 8.99539 36.1926L0.676835 33.3519C-0.225613 33.0438 -0.225611 31.7674 0.676837 31.4593L8.99539 28.6186C9.28839 28.5185 9.51852 28.2884 9.61857 27.9954L12.4593 19.6768Z"
                  fill="black"
                />
                <path
                  d="M40.4593 33.6768C40.7674 32.7744 42.0438 32.7744 42.3519 33.6768L49.2656 53.9225C49.3656 54.2155 49.5957 54.4456 49.8887 54.5456L70.1344 61.4593C71.0368 61.7674 71.0368 63.0438 70.1344 63.3519L49.8887 70.2655C49.5957 70.3656 49.3656 70.5957 49.2656 70.8887L42.3519 91.1344C42.0438 92.0368 40.7674 92.0368 40.4593 91.1344L33.5456 70.8887C33.4456 70.5957 33.2155 70.3656 32.9225 70.2655L12.6768 63.3519C11.7744 63.0438 11.7744 61.7674 12.6768 61.4593L32.9225 54.5456C33.2155 54.4456 33.4456 54.2155 33.5456 53.9225L40.4593 33.6768Z"
                  fill="black"
                />
                <path
                  d="M136.912 25.9965V76.9056H127.615L105.467 44.8637H105.094V76.9056H94.3303V25.9965H103.776L125.751 58.0135H126.198V25.9965H136.912Z"
                  fill="black"
                />
                <path
                  d="M160.407 77.6513C156.546 77.6513 153.207 76.831 150.39 75.1904C147.589 73.5332 145.426 71.2297 143.902 68.2799C142.377 65.3135 141.615 61.8748 141.615 57.9638C141.615 54.0197 142.377 50.5727 143.902 47.6229C145.426 44.6565 147.589 42.353 150.39 40.7124C153.207 39.0552 156.546 38.2266 160.407 38.2266C164.269 38.2266 167.6 39.0552 170.4 40.7124C173.218 42.353 175.389 44.6565 176.913 47.6229C178.438 50.5727 179.2 54.0197 179.2 57.9638C179.2 61.8748 178.438 65.3135 176.913 68.2799C175.389 71.2297 173.218 73.5332 170.4 75.1904C167.6 76.831 164.269 77.6513 160.407 77.6513ZM160.457 69.4482C162.214 69.4482 163.68 68.9511 164.857 67.9567C166.034 66.9458 166.92 65.5704 167.517 63.8303C168.13 62.0903 168.437 60.1099 168.437 57.8893C168.437 55.6686 168.13 53.6883 167.517 51.9482C166.92 50.2082 166.034 48.8327 164.857 47.8218C163.68 46.8109 162.214 46.3055 160.457 46.3055C158.684 46.3055 157.193 46.8109 155.983 47.8218C154.79 48.8327 153.886 50.2082 153.273 51.9482C152.677 53.6883 152.378 55.6686 152.378 57.8893C152.378 60.1099 152.677 62.0903 153.273 63.8303C153.886 65.5704 154.79 66.9458 155.983 67.9567C157.193 68.9511 158.684 69.4482 160.457 69.4482Z"
                  fill="black"
                />
                <path
                  d="M218.002 38.7238L204.653 76.9056H192.721L179.373 38.7238H190.559L198.488 66.0427H198.886L206.791 38.7238H218.002Z"
                  fill="black"
                />
                <path
                  d="M237.141 77.6513C233.213 77.6513 229.833 76.8559 226.999 75.265C224.182 73.6575 222.011 71.3871 220.486 68.4539C218.962 65.5041 218.199 62.0157 218.199 57.9887C218.199 54.0611 218.962 50.6142 220.486 47.6478C222.011 44.6814 224.157 42.3696 226.924 40.7124C229.708 39.0552 232.973 38.2266 236.718 38.2266C239.237 38.2266 241.582 38.6326 243.753 39.4447C245.941 40.2401 247.846 41.4416 249.471 43.0491C251.111 44.6565 252.387 46.6783 253.299 49.1144C254.21 51.5339 254.666 54.3677 254.666 57.6158V60.5242H222.425V53.9617H244.698C244.698 52.4371 244.366 51.0865 243.704 49.9099C243.041 48.7332 242.121 47.8135 240.944 47.1506C239.784 46.4712 238.434 46.1314 236.892 46.1314C235.285 46.1314 233.86 46.5043 232.617 47.2501C231.391 47.9792 230.429 48.9653 229.733 50.2081C229.037 51.4345 228.681 52.8017 228.664 54.3097V60.5491C228.664 62.4383 229.012 64.0706 229.708 65.4461C230.421 66.8215 231.424 67.8822 232.716 68.6279C234.009 69.3736 235.542 69.7465 237.315 69.7465C238.492 69.7465 239.569 69.5808 240.547 69.2493C241.524 68.9179 242.361 68.4207 243.057 67.7579C243.753 67.095 244.284 66.283 244.648 65.3218L254.442 65.9681C253.945 68.3213 252.926 70.3762 251.385 72.1329C249.86 73.8729 247.888 75.2318 245.468 76.2096C243.065 77.1707 240.29 77.6513 237.141 77.6513Z"
                  fill="black"
                />
                <path
                  d="M269.716 25.9965V76.9056H259.126V25.9965H269.716Z"
                  fill="black"
                />
              </svg>
            </Tooltip>
          </div> */}
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

export default RoteInputSimple;
