import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  GlobalOutlined,
  HourglassOutlined,
  PushpinOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Modal, Popover, Tooltip } from "antd";
import { formatTimeAgo } from "@/utils/main";
import mainJson from "@/json/main.json";
import { useEffect, useState } from "react";
import moment from "moment";
import { Editor } from "novel";
import RoteInputModel from "./roteInputModel";
import { apiDeleteMyRote, apiEditMyRote } from "@/api/rote/main";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { useRotesDispatch } from "@/state/rotes";
import { useFilterRotesDispatch } from "@/state/filterRotes";
import { useProfile } from "@/state/profile";
const { emojiList } = mainJson;

function RoteItem({ rote_param }: any) {
  const [rote, setRote] = useState<any>({});
  const rotesDispatch = useRotesDispatch();
  const filterRotesDispatch = useFilterRotesDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editRote, setEditRote] = useState<any>({});
  const [open, setOpen] = useState(false);

  const hide = () => {
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const profile = useProfile();

  useEffect(() => {
    setRote(rote_param);
  }, [rote_param]);

  function goFilter(tag: string) {
    if (window.location.pathname === "/explore") {
      return;
    }
    if (location.pathname.includes("/filter")) {
      navigate("../filter", {
        state: {
          tags: [tag],
        },
      });
    } else {
      navigate("filter", {
        state: {
          tags: [tag],
        },
      });
    }
  }

  const [categorizedReactions, setCategorizedReactions] = useState<any>({});
  function categorizeReactions(rote: any) {
    const categorizedReactions_temp: any = [];
    // 整理 userreaction
    rote.userreaction.forEach((reaction: any) => {
      if (categorizedReactions_temp[reaction.type]) {
        categorizedReactions_temp[reaction.type].push(reaction);
      } else {
        categorizedReactions_temp[reaction.type] = [reaction];
      }
    });

    // 整理 visitorreaction
    rote.visitorreaction.forEach((reaction: any) => {
      if (categorizedReactions_temp[reaction.type]) {
        categorizedReactions_temp[reaction.type].push(reaction);
      } else {
        categorizedReactions_temp[reaction.type] = [reaction];
      }
    });

    const resultArray: any = [];

    for (const key in categorizedReactions_temp) {
      resultArray.push({
        type: key,
        reactions: categorizedReactions_temp[key],
      });
    }

    return resultArray;
  }

  function onModelCancel() {
    setIsModalOpen(false);
    setEditRote({});
  }

  function submitEdit(rote: any) {
    const {
      author,
      userreaction,
      visitorreaction,
      attachments,
      createdAt,
      updatedAt,
      ...cleanRote
    } = rote;
    setIsModalOpen(false);
    const toastId = toast.loading("发送中...");
    apiEditMyRote({
      ...cleanRote,
      content: cleanRote.content.trim(),
    })
      .then((res) => {
        rotesDispatch({
          type: "updateOne",
          rote: res.data.data,
        });
        filterRotesDispatch({
          type: "updateOne",
          rote: res.data.data,
        });
        toast.success("发送成功", {
          id: toastId,
        });
        setRote(res.data.data);
      })
      .catch((err) => {
        toast.error("发送失败", {
          id: toastId,
        });
      });
  }
  function actionsMenu(rote: any) {
    function deleteRote() {
      hide();
      const toastId = toast.loading("删除中...");
      apiDeleteMyRote({
        id: rote.id,
        authorid: rote.authorid,
      })
        .then((res) => {
          toast.success("删除成功", {
            id: toastId,
          });
          rotesDispatch({
            type: "deleted",
            roteid: res.data.data.id,
          });
          filterRotesDispatch({
            type: "deleted",
            roteid: res.data.data.id,
          });
        })
        .catch((err) => {
          toast.error("删除失败", {
            id: toastId,
          });
        });
    }
    function editRotePin() {
      hide();
      const toastId = toast.loading("编辑中...");
      apiEditMyRote({
        id: rote.id,
        authorid: rote.authorid,
        pin: !rote.pin,
      })
        .then((res) => {
          rotesDispatch({
            type: "updateOne",
            rote: res.data.data,
          });
          filterRotesDispatch({
            type: "updateOne",
            rote: res.data.data,
          });
          toast.success(`${rote.pin ? "取消置顶" : "置顶"}成功`, {
            id: toastId,
          });
          setRote(res.data.data);
        })
        .catch((err) => {
          toast.error("发送失败", {
            id: toastId,
          });
        });
    }
    function editRoteArchived() {
      hide();
      const toastId = toast.loading("编辑中...");
      apiEditMyRote({
        id: rote.id,
        authorid: rote.authorid,
        archived: !rote.archived,
      })
        .then((res) => {
          rotesDispatch({
            type: "deleted",
            roteid: res.data.data.id,
          });
          filterRotesDispatch({
            type: "deleted",
            roteid: res.data.data.id,
          });
          toast.success(`${rote.pin ? "取消归档" : "归档"}成功`, {
            id: toastId,
          });
          setRote(res.data.data);
        })
        .catch((err) => {
          toast.error("请求失败", {
            id: toastId,
          });
        });
    }
    return (
      <div className=" flex flex-col">
        <div
          className=" py-1 px-2 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={editRotePin}
        >
          <PushpinOutlined />
          {rote.pin ? "取消置顶" : "置顶"}
        </div>
        <div
          className=" py-1 px-2 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={() => {
            hide();
            setIsModalOpen(true);
            setEditRote(rote);
          }}
        >
          <EditOutlined />
          编辑
        </div>
        <div
          className=" py-1 px-2 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={editRoteArchived}
        >
          <SaveOutlined />
          {rote.archived ? "取消归档" : "归档"}
        </div>
        <div
          className=" py-1 px-2 text-red-500 rounded-md font-semibold hover:bg-[#00000010] flex gap-2 cursor-pointer"
          onClick={deleteRote}
        >
          <DeleteOutlined />
          删除
        </div>
      </div>
    );
  }

  return rote.id ? (
    <div
      id={`Rote_${rote.id}`}
      className=" opacity-0 translate-y-5 animate-show cursor-pointer duration-300 hover:bg-[#00000005] flex gap-4 bg-white border-b border-[#00000010] first:border-t last:border-b-[0] w-full py-4 px-5"
    >
      <Avatar
        className=" bg-[#00000010] text-black shrink-0 hidden sm:block"
        size={{ xs: 24, sm: 32, md: 40, lg: 50, xl: 50, xxl: 50 }}
        icon={<UserOutlined className=" text-[#00000030]" />}
        src={
          rote.author.username === profile?.username
            ? profile?.avatar
            : rote.author.avatar
        }
      />
      <div className=" flex flex-col w-full">
        <div className=" cursor-default w-full flex items-center">
          <span className=" cursor-pointer font-semibold hover:underline">
            {rote.author.username === profile?.username
              ? profile?.nickname
              : rote.author.nickname}
          </span>
          <span className=" overflow-scroll text-nowrap ml-2 font-normal text-gray-500">
            {`@${rote.author.username}`}
            <span> · </span>{" "}
            <Tooltip
              placement="bottom"
              title={moment.utc(rote.createdAt).format("YYYY/MM/DD HH:mm:ss")}
            >
              <span
                className={`${
                  new Date().getTime() - new Date(rote.createdAt).getTime() >
                  60 * 1000
                    ? ""
                    : " bg-primaryGreenGradient bg-clip-text text-transparent"
                }`}
              >
                {formatTimeAgo(rote.createdAt)}
              </span>
            </Tooltip>
          </span>

          <span className=" flex gap-1 ml-2 text-gray-500">
            {rote.pin ? (
              <Tooltip
                placement="bottom"
                title={rote.pin ? "已置顶" : "未置顶"}
              >
                <PushpinOutlined
                  className={` cursor-pointer text-md rounded-md`}
                />
              </Tooltip>
            ) : null}

            {rote.state === "draft" ? (
              <Tooltip placement="bottom" title={`草稿`}>
                <HourglassOutlined
                  className={` cursor-pointer text-md rounded-md`}
                />
              </Tooltip>
            ) : rote.state === "public" ? (
              <Tooltip placement="bottom" title={`公开`}>
                <GlobalOutlined
                  className={` cursor-pointer text-md rounded-md`}
                />
              </Tooltip>
            ) : null}

            {rote.updatedAt !== rote.createdAt ? (
              <Tooltip
                placement="bottom"
                title={`已编辑：${moment
                  .utc(rote.updatedAt)
                  .format("YYYY/MM/DD HH:mm:ss")}`}
              >
                <EditOutlined
                  className={` cursor-pointer text-md rounded-md`}
                />
              </Tooltip>
            ) : null}
          </span>
          {profile?.username === rote.author.username && (
            <Popover
              placement="bottomRight"
              open={open}
              onOpenChange={handleOpenChange}
              content={actionsMenu(rote)}
            >
              <EllipsisOutlined className=" ml-auto hover:bg-[#00000010] rounded-full p-2" />
            </Popover>
          )}
        </div>
        {rote.editor === "normal" ? (
          <div className=" break-words whitespace-pre-line text-[16px]">
            {rote.content}
          </div>
        ) : (
          <Editor
            className={` pointer-events-none text-lg max-h-96 overflow-y-scroll py-3 noScrollBar gap-0 `}
            defaultValue={JSON.parse(rote.content)}
            disableLocalStorage
            onUpdate={(e) => {
              let json = e?.getJSON();
              console.log(JSON.stringify(json));
              console.log(e?.getJSON());
              console.log(e?.getText());
            }}
          />
        )}
        <div className=" flex items-center flex-wrap gap-2 my-2">
          {rote.tags.map((tag: any, index: any) => {
            return (
              <div
                className=" px-2 py-1 text-xs rounded-md bg-[#00000010] duration-300 hover:scale-95"
                key={`tag_${index}`}
                onClick={() => {
                  goFilter(tag);
                }}
              >
                {tag}
              </div>
            );
          })}
        </div>
        {/* <div className=" flex items-center flex-wrap gap-2 my-2">
          {categorizedReactions.length > 0
            ? categorizedReactions.map((item: any, index: number) => {
              return (
                <div
                  className=" cursor-pointer duration-300 hover:scale-95 flex items-center gap-2 px-3 py-1 bg-white border rounded-full text-sm"
                  key={`reaction_${index}`}
                >
                  <span>{item.type}</span>
                  <span>{item.reactions.length}</span>
                </div>
              );
            })
            : null}
          <Popover
            placement="bottom"
            content={
              <div className=" flex gap-2">
                {emojiList.map((emoji, index) => {
                  return (
                    <div
                      className=" py-2 px-3 rounded-md hover:bg-[#00000010] cursor-pointer text-xl"
                      key={`emoji_${index}`}
                    >
                      {emoji}
                    </div>
                  );
                })}
              </div>
            }
          >
            <div className=" p-1 w-8 h-8 hover:bg-[#00000010] rounded-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                fill="none"
              >
                <path
                  d="M28 12.3999V20C22.42 20.1 20.1 22.42 20 28H12.4C6.4 28 4 25.6001 4 19.6001V12.3999C4 6.3999 6.4 4 12.4 4H19.6C25.6 4 28 6.3999 28 12.3999Z"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.92 11.7402C12.86 11.0202 11.46 11.0202 10.4 11.7802"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21.92 11.7402C20.86 11.0202 19.46 11.0202 18.4 11.7802"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.32 22.8403H11.68C11.08 22.8403 10.6 22.3603 10.6 21.7603C10.6 18.7803 13.02 16.3604 16 16.3604C17.28 16.3604 18.46 16.8003 19.38 17.5403"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M44 28.3999V35.6001C44 41.6001 41.6 44 35.6 44H28.4C22.4 44 20 41.6001 20 35.6001V28C20.1 22.42 22.42 20.1 28 20H35.6C41.6 20 44 22.3999 44 28.3999Z"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M29.92 27.2402C28.86 27.9602 27.46 27.9602 26.4 27.2002"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M37.92 27.2402C36.86 27.9602 35.46 27.9602 34.4 27.2002"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M27.68 32.3604H36.32C36.92 32.3604 37.4 32.8402 37.4 33.4402C37.4 36.4202 34.98 38.8403 32 38.8403C29.02 38.8403 26.6 36.4202 26.6 33.4402C26.6 32.8402 27.08 32.3604 27.68 32.3604Z"
                  stroke="#171717"
                  strokeWidth="3"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Popover>
        </div> */}
      </div>
      <Modal
        title="编辑"
        open={isModalOpen}
        onCancel={onModelCancel}
        maskClosable={true}
        destroyOnClose={true}
        footer={null}
      >
        <RoteInputModel
          rote={editRote}
          submitEdit={submitEdit}
        ></RoteInputModel>
      </Modal>
    </div>
  ) : null;
}

export default RoteItem;
