import {
  Archive,
  ArrowDownLeft,
  Edit,
  Edit3,
  Ellipsis,
  Globe2Icon,
  Layers,
  LinkIcon,
  PinIcon,
  PinOff,
  Save,
  Share,
  Trash2,
  User,
} from "lucide-react";
import Linkify from "react-linkify";

import { apiDeleteMyRote, apiEditMyRote } from "@/api/rote/main";
import { getMyProfile } from "@/api/user/main";
import mainJson from "@/json/main.json";
import { Profile, Rote } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { formatTimeAgo } from "@/utils/main";
import { Avatar, Modal, Popover, Tooltip } from "antd";
import moment from "moment";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useInView } from "react-intersection-observer";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { Link } from "react-router-dom";
import { SWRInfiniteKeyedMutator } from "swr/dist/infinite";
import RoteInputModel from "./roteInputModel";
import RoteShareCard from "./roteShareCard";
const { roteContentExpandedLetter } = mainJson;

function RoteItem({ rote, randomRoteStyle, mutate }: {
  rote: Rote;
  randomRoteStyle?: boolean;
  mutate?: SWRInfiniteKeyedMutator<any[]>;
}) {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.roteItem",
  });
  const { ref, inView } = useInView();

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isShareCardModalOpen, setIsShareCardModalOpen] = useState<boolean>(
    false,
  );
  const [open, setOpen] = useState(false);

  const [isExpanded, setIsExpanded] = useState<any>(false);

  const hide = () => {
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const { data: profile } = useAPIGet<Profile>(
    "profile",
    getMyProfile,
  );

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  function onShareCardModelCancel() {
    setIsShareCardModalOpen(false);
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
    setIsEditModalOpen(false);
    const toastId = toast.loading(t("messages.sending", "发送中..."));

    apiEditMyRote({
      ...cleanRote,
      content: cleanRote.content.trim(),
    })
      .then((res) => {
        if (res.data.code !== 0) {
          return;
        }
        toast.success(t("messages.sendSuccess", "发送成功"), {
          id: toastId,
        });

        mutate && mutate(
          (currentData) => {
            // 处理嵌套数组结构
            return currentData?.map((page) =>
              Array.isArray(page)
                ? page.map((r) => r.id === rote.id ? res.data.data : r)
                : page
            );
          },
          {
            revalidate: false,
          },
        );
      })
      .catch(() => {
        toast.error(t("messages.sendFailed", "发送失败"), {
          id: toastId,
        });
      });
  }

  function actionsMenu(rote: Rote) {
    function deleteRoteFn() {
      hide();
      const toastId = toast.loading(t("messages.deleting"));
      apiDeleteMyRote({
        id: rote.id,
        authorid: rote.authorid,
      })
        .then((res) => {
          toast.success(t("messages.deleteSuccess"), {
            id: toastId,
          });

          mutate && mutate(
            (currentData) => {
              // 处理嵌套数组结构
              return currentData?.map((page) =>
                Array.isArray(page)
                  ? page.filter((r) => r.id !== rote.id)
                  : page
              );
            },
            {
              revalidate: false,
            },
          );
        })
        .catch(() => {
          toast.error(t("messages.deleteFailed"), {
            id: toastId,
          });
        });
    }

    function editRotePin() {
      hide();
      const toastId = toast.loading(t("messages.editing"));
      apiEditMyRote({
        id: rote.id,
        authorid: rote.authorid,
        pin: !rote.pin,
      })
        .then((res) => {
          if (res.data.code !== 0) {
            return;
          }
          toast.success(
            `${rote.pin ? t("unpinned") : t("pinned")}${
              t(
                "messages.editSuccess",
                "成功",
              )
            }`,
            {
              id: toastId,
            },
          );

          mutate && mutate(
            (currentData) => {
              // 处理嵌套数组结构
              return currentData?.map((page) =>
                Array.isArray(page)
                  ? page.map((r) => r.id === rote.id ? res.data.data : r)
                  : page
              );
            },
            {
              revalidate: false,
            },
          );
        })
        .catch(() => {
          toast.error(t("messages.editFailed"), {
            id: toastId,
          });
        });
    }
    function editRoteArchived() {
      hide();
      const toastId = toast.loading(t("messages.editing"));
      apiEditMyRote({
        id: rote.id,
        authorid: rote.authorid,
        archived: !rote.archived,
      })
        .then((res) => {
          if (res.data.code !== 0) {
            return;
          }
          toast.success(
            `${rote.archived ? t("unarchive") : t("archive")}${
              t(
                "messages.editSuccess",
              )
            }`,
            {
              id: toastId,
            },
          );

          mutate && mutate(
            (currentData) => {
              // 处理嵌套数组结构
              return currentData?.map((page) =>
                Array.isArray(page)
                  ? page.map((r) => r.id === rote.id ? res.data.data : r)
                  : page
              );
            },
            {
              revalidate: false,
            },
          );
        })
        .catch(() => {
          toast.error(t("messages.editFailed"), {
            id: toastId,
          });
        });
    }
    return (
      <div className=" flex flex-col">
        <Link
          className=" py-1 px-2 rounded-md font-semibold hover:bg-opacityLight dark:hover:bg-opacityDark flex gap-2 cursor-pointer items-center"
          to={`/rote/${rote.id}`}
        >
          <Layers className="size-4" />
          {t("details")}
        </Link>
        <div
          className=" py-1 px-2 rounded-md font-semibold hover:bg-opacityLight dark:hover:bg-opacityDark flex gap-2 cursor-pointer items-center"
          onClick={editRotePin}
        >
          {rote.pin
            ? <PinOff className="size-4" />
            : <PinIcon className="size-4" />}
          {rote.pin ? t("unpinned") : t("pinned")}
        </div>
        <div
          className=" py-1 px-2 rounded-md font-semibold hover:bg-opacityLight dark:hover:bg-opacityDark flex gap-2 cursor-pointer items-center"
          onClick={() => {
            hide();
            setIsEditModalOpen(true);
          }}
        >
          <Edit3 className="size-4" />
          {t("edit")}
        </div>
        <div
          className=" py-1 px-2 rounded-md font-semibold  hover:bg-opacityLight dark:hover:bg-opacityDark flex gap-2 cursor-pointer items-center"
          onClick={editRoteArchived}
        >
          <Save className="size-4" />
          {rote.archived ? t("unarchive") : t("archive")}
        </div>
        <div
          className=" py-1 px-2 rounded-md font-semibold  hover:bg-opacityLight dark:hover:bg-opacityDark flex gap-2 cursor-pointer items-center"
          onClick={() => {
            hide();
            setIsShareCardModalOpen(true);
          }}
        >
          <Share className="size-4" />
          {t("share")}
        </div>
        <div
          className=" py-1 px-2 text-red-500 rounded-md font-semibold  hover:bg-opacityLight dark:hover:bg-opacityDark gap-2 cursor-pointer flex items-center"
          onClick={deleteRoteFn}
        >
          <Trash2 className="size-4" />
          {t("delete")}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      id={`Rote_${rote.id}`}
      className={` opacity-0 translate-y-5 animate-show duration-300 flex gap-4 bg-bgLight/5 dark:bg-bgDark/5 border-opacityLight dark:border-opacityDark border-b first:border-t-[0] last:border-b-[0] w-full ${
        !randomRoteStyle && " py-4 px-5"
      }`}
    >
      {!randomRoteStyle && (
        <Link
          className=" text-black shrink-0 hidden sm:block"
          to={`/${rote.author!.username}`}
        >
          <Avatar
            className=" bg-[#00000010]"
            size={{ xs: 24, sm: 32, md: 40, lg: 40, xl: 50, xxl: 50 }}
            icon={<User className=" text-[#00000030] size-4" />}
            src={rote.author!.username === profile?.username
              ? profile?.avatar
              : rote.author!.avatar}
          />
        </Link>
      )}

      <div className=" flex flex-col w-full">
        <div className=" cursor-default w-full flex gap-2 items-center">
          {!randomRoteStyle && (
            <Link
              className=" cursor-pointer font-semibold hover:underline"
              to={`/${rote.author!.username}`}
            >
              {rote.author!.username === profile?.username
                ? profile?.nickname
                : rote.author!.nickname}
            </Link>
          )}

          <span className=" overflow-scroll noScrollBar text-nowrap font-normal text-gray-500">
            {!randomRoteStyle && (
              <>
                <Link
                  to={`/${rote.author!.username}`}
                >
                  {`@${rote.author!.username}`}
                </Link>
                <span>·</span>
                {" "}
              </>
            )}

            <Tooltip
              placement="bottom"
              title={moment.utc(rote.createdAt).format(
                "YYYY/MM/DD HH:mm:ss",
              )}
            >
              <span
                className={`${
                  new Date().getTime() -
                        new Date(rote.createdAt).getTime() >
                      60 * 1000
                    ? ""
                    : " bg-primaryGreenGradient bg-clip-text text-transparent"
                }`}
              >
                {formatTimeAgo(rote.createdAt)}
              </span>
            </Tooltip>
          </span>

          <span className=" flex gap-1 text-gray-500">
            {rote.pin
              ? (
                <Tooltip
                  placement="bottom"
                  title={rote.pin
                    ? t("tooltips.pinned")
                    : t("tooltips.unpinned")}
                >
                  <PinIcon
                    className={` cursor-pointer size-4 rounded-md`}
                  />
                </Tooltip>
              )
              : null}

            {rote.state === "public"
              ? (
                <Tooltip placement="bottom" title={t("tooltips.public")}>
                  <Globe2Icon
                    className={` cursor-pointer size-4 rounded-md`}
                  />
                </Tooltip>
              )
              : null}

            {rote.archived
              ? (
                <Tooltip placement="bottom" title={t("tooltips.archived")}>
                  <Archive
                    className={` cursor-pointer size-4 rounded-md`}
                  />
                </Tooltip>
              )
              : null}

            {rote.updatedAt !== rote.createdAt
              ? (
                <Tooltip
                  placement="bottom"
                  title={moment
                    .utc(rote.updatedAt)
                    .format("YYYY/MM/DD HH:mm:ss")}
                >
                  <Edit
                    className={` cursor-pointer size-4 rounded-md`}
                  />
                </Tooltip>
              )
              : null}

            {rote.state === "public"
              ? (
                <Tooltip placement="bottom" title={t("tooltips.copyLink")}>
                  <LinkIcon
                    className={` cursor-pointer size-4 rounded-md`}
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/rote/${rote.id}`,
                      );
                      toast.success(t("messages.copySuccess"));
                    }}
                  />
                </Tooltip>
              )
              : null}
          </span>
          {profile?.username === rote.author!.username && inView &&
            mutate !== undefined && (
            <Popover
              placement="bottomRight"
              open={open}
              onOpenChange={handleOpenChange}
              content={actionsMenu(rote)}
            >
              <Ellipsis className=" z-10 absolute right-2 top-2 size-8  hover:bg-opacityLight dark:hover:bg-opacityDark rounded-full p-2" />
            </Popover>
          )}
        </div>

        <div className=" font-zhengwen break-words whitespace-pre-line text-[16px] relative">
          <div className="aTagStyle">
            {rote.content.length > roteContentExpandedLetter
              ? (
                isExpanded ? <Linkify>{rote.content}</Linkify> : (
                  <Linkify>
                    {`${
                      rote.content.slice(
                        0,
                        roteContentExpandedLetter,
                      )
                    }...`}
                  </Linkify>
                )
              )
              : <Linkify>{rote.content}</Linkify>}
          </div>

          {rote.content.length > roteContentExpandedLetter && (
            <>
              {!isExpanded && (
                <div
                  onClick={toggleExpand}
                  className=" hover:text-primary cursor-pointer gap-1 duration-300 absolute bottom-0 bg-gradient-to-t text-gray-700  from-bgLight dark:from-bgDark via-bgLight/80 dark:via-bgDark/80 to-transparent pt-8 flex w-full justify-center items-center"
                >
                  <ArrowDownLeft className="size-4" />
                  {t("expand")}
                </div>
              )}
            </>
          )}
        </div>

        {rote.attachments.length > 0 && (
          <div className=" w-fit my-2 flex flex-wrap gap-1 border border-opacityLight dark:border-opacityDark rounded-2xl overflow-hidden">
            <PhotoProvider>
              {rote.attachments.map((file: any, index: any) => {
                return (
                  <PhotoView key={`files_${index}`} src={file.url}>
                    <img
                      className={`${
                        rote.attachments.length % 3 === 0
                          ? "w-[calc(1/3*100%-2.6667px)] aspect-1"
                          : rote.attachments.length % 2 === 0
                          ? "w-[calc(1/2*100%-2px)] aspect-1"
                          : rote.attachments.length === 1
                          ? " w-full max-w-[500px] rounded-2xl"
                          : "w-[calc(1/3*100%-2.6667px)] aspect-1"
                      } object-cover grow bg-opacityLight dark:bg-opacityDark`}
                      src={file.compressUrl || file.url}
                      loading="lazy"
                      alt=""
                    />
                  </PhotoView>
                );
              })}
            </PhotoProvider>
          </div>
        )}
        <div className=" flex items-center flex-wrap gap-2 my-2">
          {rote.tags.map((tag: any, index: any) => {
            return (
              <Link
                key={tag}
                to={"/filter"}
                state={{
                  tags: [tag],
                }}
              >
                <div className=" px-2 py-1 text-xs rounded-md bg-opacityLight dark:bg-opacityDark hover:scale-95 duration-300">
                  {tag}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {inView && (
        <>
          <Modal
            title={t("edit")}
            open={isEditModalOpen}
            onCancel={() => {
              setIsEditModalOpen(false);
            }}
            maskClosable={true}
            destroyOnClose={true}
            footer={null}
          >
            <RoteInputModel
              rote={rote}
              submitEdit={submitEdit}
              mutate={mutate}
            />
          </Modal>
          <Modal
            title={t("share")}
            open={isShareCardModalOpen}
            onCancel={onShareCardModelCancel}
            maskClosable={true}
            destroyOnClose={true}
            footer={null}
          >
            <RoteShareCard rote={rote}></RoteShareCard>
          </Modal>
        </>
      )}
    </div>
  );
}

export default RoteItem;
