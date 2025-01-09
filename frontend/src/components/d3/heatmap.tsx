// src/Heatmap.tsx
import { apiGetMyHeatMap } from "@/api/others/main";
import { HeatMapDay } from "@/types/main";
import Empty from "antd/es/empty";
import moment from "moment";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

const Heatmap: React.FC = () => {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.d3.heatmap",
  });

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

  const [heatmapData, setHeatmapData] = useState<any>({});
  const [days, setDays] = useState<any>([]);

  useEffect(() => {
    apiGetMyHeatMap({}).then((res) => {
      setHeatmapData(res.data);
    });
  }, []);

  useEffect(() => {
    if (Object.keys(heatmapData).length === 0) {
      return;
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
      const notesCount = heatmapData[dateString] || 0;
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

    setDays(weeks);

    // if (svgRef.current) {
    //   const svg = d3
    //     .select(svgRef.current)
    //     .attr("width", containerWidth)
    //     .attr("height", height + margin.top + margin.bottom)
    //     .append("g")
    //     .attr("transform", `translate(${margin.left},${margin.top})`);

    //   const startWeek = parseInt(formatWeek(startDate));

    //   // 添加礼拜几的标签
    //   svg
    //     .selectAll(".day-of-week")
    //     .data(daysOfWeek)
    //     .enter()
    //     .append("text")
    //     .attr("class", "day-of-week")
    //     .attr("x", -16)
    //     .attr("y", (d, i) => i * cellSize + cellSize / 2)
    //     .attr("dy", "0.35em")
    //     .style("text-anchor", "end")
    //     .style("font-size", "10px")
    //     .text((d) => d);

    //   svg
    //     .selectAll(".day")
    //     .data(days)
    //     .enter()
    //     .append("rect")
    //     .attr("class", "day")
    //     .attr("width", cellSize - padding)
    //     .attr("height", cellSize - padding)
    //     .attr(
    //       "x",
    //       (d) =>
    //         (parseInt(formatWeek(d)) - startWeek) * cellSize + padding / 2 - 20
    //     )
    //     .attr("y", (d) => parseInt(formatDay(d)) * cellSize + padding / 2)
    //     .attr("rx", 3) // 添加圆角
    //     .attr("ry", 3) // 添加圆角
    //     .datum(formatDate)
    //     .attr("fill", (d) => color(heatmapData[d] || 0))
    //     .attr(
    //       "data-title",
    //       (d) =>
    //         `${formatMonthDay(new Date(d))}: ${heatmapData[d] || 0} ${t(
    //           "notes"
    //         )}`
    //     ) // 显示日期和贡献数量
    //     .on("click", function (e) {
    //       const target = e.target as HTMLElement;
    //       if (target.dataset.title) {
    //         toast(target.dataset.title, {
    //           icon: "🌱",
    //         });
    //       }
    //     });
    // }
  }, [heatmapData]);

  const handleDayClick = (day: HeatMapDay) => {
    toast(
      `${moment.utc(day.date).format("YYYY/MM/DD")} ${day.notesCount} Notes.`,
      {
        icon: "🌱",
      }
    );
  };

  return (
    <>
      {Object.keys(heatmapData).length > 0 ? (
        <div className=" flex gap-2">
          <div className=" flex flex-col justify-around">
            {daysOfWeek.map((day) => (
              <div key={day} className=" text-[10px] text-right">
                {day}
              </div>
            ))}
          </div>
          <div className=" flex gap-1">
            {days.map((week: any, index: number) => (
              <div key={`week_${index}`} className=" flex flex-col gap-1">
                {week.map((day: any, index: number) => (
                  <div
                    key={index}
                    className=" w-4 h-4 rounded-sm hover:scale-105 duration-300"
                    style={{
                      backgroundColor: day.notesCount
                        ? colors[Math.min(day.notesCount, colors.length - 1)]
                        : colors[0],
                    }}
                    onClick={() => handleDayClick(day)}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className=" shrink-0 border-t-[1px] border-opacityLight dark:border-opacityDark py-4">
          <Empty
            className=" dark:text-textDark"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("noData")}
          />
        </div>
      )}
    </>
  );
};

export default Heatmap;
