import { UserOutlined } from "@ant-design/icons";
import { Avatar, Popover, Tooltip } from "antd";
import { formatTimeAgo } from "@/utils/main";
import mainJson from "@/json/main.json";
import { useEffect, useState } from "react";
import moment from "moment";
import { Editor } from "novel";
const { emojiList } = mainJson;

function RoteInputSimple({ rote }: any) {
  const [categorizedReactions, setCategorizedReactions]: any = useState({});
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

  useEffect(() => {
    setCategorizedReactions(categorizeReactions(rote));
  }, [rote]);

  return (
    <div className=" cursor-pointer duration-300 hover:bg-[#00000005] flex gap-4 bg-white border-b border-[#00000010] first:border-t last:border-b-[0] w-full py-4 px-5">
      <Avatar
        className=" bg-[#00000010] text-black shrink-0 hidden sm:block"
        size={{ xs: 24, sm: 32, md: 40, lg: 50, xl: 50, xxl: 50 }}
        icon={<UserOutlined />}
        src={rote.author.avatar}
      />
      <div className=" flex flex-col">
        <div className=" cursor-default">
          <span className=" cursor-pointer font-semibold hover:underline">
            {rote.author.nickname}
          </span>
          <span className=" ml-2 font-normal text-gray-500">
            {`@${rote.author.username}`}
            <span> · </span>{" "}
            <Tooltip
              placement="bottom"
              title={moment.utc(rote.createdAt).format("YYYY/MM/DD HH:mm:ss")}
            >
              <span>{formatTimeAgo(rote.createdAt)}</span>
            </Tooltip>
          </span>
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

        <div className=" flex items-center gap-2 my-2">
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
        </div>
      </div>
    </div>
  );
}

export default RoteInputSimple;
