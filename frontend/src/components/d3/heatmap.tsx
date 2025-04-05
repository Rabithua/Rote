// src/Heatmap.tsx
import { apiGetMyHeatMap } from "@/api/others/main";
import { HeatMapDay } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { Empty } from "antd";
import moment from "moment";
import React from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import LoadingPlaceholder from "../LoadingPlaceholder";

const Heatmap: React.FC = () => {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.d3.heatmap",
  });

  const { data: heatmapData, isLoading } = useAPIGet<
    {
      [key: string]: number;
    }
  >(
    "heatmap",
    apiGetMyHeatMap,
  );

  const colors = [
    "#cccccc20",
    "#07C16030",
    "#07C16050",
    "#07C16070",
    "#07C16090",
    "#07C160",
  ];

  const daysOfWeek = [
    t("daysOfWeek.Sun"),
    t("daysOfWeek.Mon"),
    t("daysOfWeek.Tue"),
    t("daysOfWeek.Wed"),
    t("daysOfWeek.Thu"),
    t("daysOfWeek.Fri"),
    t("daysOfWeek.Sat"),
  ];

  function parseDays(data: any) {
    if (isLoading || !data) {
      return [];
    }

    if (Object.keys(data).length === 0) {
      return [];
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (70 + startDate.getDay() || 7));

    // 生成起止日期之间的所有日期
    const dates = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      dates.push(new Date(d));
    }

    // 按周几分成小数组，并带上当天的笔记个数
    const weeks = [];
    let currentWeek: HeatMapDay[] = [];

    dates.forEach((date) => {
      const dateString = date.toISOString().split("T")[0];
      const notesCount = data[dateString] || 0;
      currentWeek.push({ date, notesCount });
      if (date.getDay() === 6) {
        // 周六
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  const handleDayClick = (day: HeatMapDay) => {
    toast(
      `${moment.utc(day.date).format("YYYY/MM/DD")} ${day.notesCount} Notes.`,
      {
        icon: "🌱",
      },
    );
  };

  return (
    <>
      {isLoading
        ? (
          <LoadingPlaceholder
            className=" py-8"
            size={6}
          />
        )
        : heatmapData && Object.keys(heatmapData).length === 0
        ? (
          <div className=" shrink-0 border-t-[1px] border-opacityLight dark:border-opacityDark py-4">
            <Empty
              className=" dark:text-textDark"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("noData")}
            />
          </div>
        )
        : (
          <div className=" flex gap-2">
            <div className=" flex flex-col justify-around shrink-0">
              {daysOfWeek.map((day) => (
                <div key={day} className=" text-[10px] text-right">
                  {day}
                </div>
              ))}
            </div>
            <div className=" flex md:gap-1 gap-1.5 overflow-y-scroll noScrollBar">
              {parseDays(heatmapData).map((week: any, index: number) => (
                <div
                  key={`week_${index}`}
                  className=" flex flex-col md:gap-1 gap-1.5"
                >
                  {week.map((day: any, index: number) => (
                    <div
                      key={index}
                      className=" size-5 md:size-4 rounded-sm hover:scale-105 duration-300"
                      style={{
                        backgroundColor: day.notesCount
                          ? colors[Math.min(day.notesCount, colors.length - 1)]
                          : colors[0],
                      }}
                      onClick={() => handleDayClick(day)}
                    >
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
    </>
  );
};

export default Heatmap;
