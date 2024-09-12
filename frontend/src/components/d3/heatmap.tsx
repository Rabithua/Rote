// src/Heatmap.tsx
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import toast from "react-hot-toast";
import { apiGetMyHeatMap } from "@/api/others/main";
import Empty from "antd/es/empty";

const Heatmap: React.FC = () => {
  const [heatmapData, setHeatmapData] = useState<any>({});
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(260); // 默认宽度

  useEffect(() => {
    apiGetMyHeatMap({}).then((res) => {
      setHeatmapData(res.data);
    });
  }, []);

  useEffect(() => {
    if (Object.keys(heatmapData).length === 0) {
      return;
    }
    const height = 150;
    const cellSize = 20;
    const padding = 5;
    const margin = { top: 0, right: 20, bottom: 0, left: 40 }; // 增加左边距以容纳礼拜几的标签

    const formatDay = d3.timeFormat("%w");
    const formatWeek = d3.timeFormat("%U");
    const formatDate = d3.timeFormat("%Y-%m-%d");
    const formatMonthDay = d3.timeFormat("%B %d, %Y"); // 格式化为 月 日, 年

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const color = d3
      .scaleLinear<string>()
      .domain([0, 1, 2, 3, 4])
      .range([
        "#07C16010",
        "#07C16020",
        "#07C16040",
        "#07C16060",
        "#07C16080",
        "#07C160",
      ]);

    if (svgRef.current) {
      const svg = d3
        .select(svgRef.current)
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 71 - startDate.getDay());

      const days = d3.timeDays(startDate, endDate);

      const startWeek = parseInt(formatWeek(startDate));

      // 添加礼拜几的标签
      svg
        .selectAll(".day-of-week")
        .data(daysOfWeek)
        .enter()
        .append("text")
        .attr("class", "day-of-week")
        .attr("x", -16)
        .attr("y", (d, i) => i * cellSize + cellSize / 2)
        .attr("dy", "0.35em")
        .style("text-anchor", "end")
        .style("font-size", "10px")
        .text((d) => d);

      svg
        .selectAll(".day")
        .data(days)
        .enter()
        .append("rect")
        .attr("class", "day")
        .attr("width", cellSize - padding)
        .attr("height", cellSize - padding)
        .attr(
          "x",
          (d) =>
            (parseInt(formatWeek(d)) - startWeek) * cellSize + padding / 2 - 20
        )
        .attr("y", (d) => parseInt(formatDay(d)) * cellSize + padding / 2)
        .attr("rx", 3) // 添加圆角
        .attr("ry", 3) // 添加圆角
        .datum(formatDate)
        .attr("fill", (d) => color(heatmapData[d] || 0))
        .attr(
          "data-title",
          (d) => `${formatMonthDay(new Date(d))}: ${heatmapData[d] || 0} Notes`
        ) // 显示日期和贡献数量
        .on("click", function (e) {
          const target = e.target as HTMLElement;
          if (target.dataset.title) {
            toast(target.dataset.title, {
              icon: "🌱",
            });
          }
        });
    }
  }, [heatmapData, containerWidth]);

  return (
    <>
      {Object.keys(heatmapData).length > 0 ? (
        <svg className=" shrink-0  dark:fill-textDark" ref={svgRef}></svg>
      ) : (
        <div className=" shrink-0 border-t-[1px] border-opacityLight dark:border-opacityDark py-4">
          <Empty
            className=" dark:text-textDark"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"HeatMap 无数据"}
          />
        </div>
      )}
    </>
  );
};

export default Heatmap;
