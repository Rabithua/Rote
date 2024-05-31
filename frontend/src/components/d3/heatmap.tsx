// src/Heatmap.tsx
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface HeatmapProps {
  data: { [key: string]: number };
}

const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(260); // 默认宽度

  useEffect(() => {
    const height = 150;
    const cellSize = 20;
    const padding = 5;
    const margin = { top: 20, right: 20, bottom: 20, left: 40 }; // 增加左边距以容纳礼拜几的标签

    const formatDay = d3.timeFormat("%w");
    const formatWeek = d3.timeFormat("%U");
    const formatDate = d3.timeFormat("%Y-%m-%d");
    const formatMonthDay = d3.timeFormat("%B %d, %Y"); // 格式化为 月 日, 年

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const color = d3
      .scaleLinear<string>()
      .domain([0, 1, 2, 3, 4])
      .range(["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"]);

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
          (d) => parseInt(formatWeek(d)) * cellSize + padding / 2 - 230
        )
        .attr("y", (d) => parseInt(formatDay(d)) * cellSize + padding / 2)
        .datum(formatDate)
        .attr("fill", (d) => color(data[d] || 0))
        .append("title") // 添加 title 元素
        .text(
          (d) => `${formatMonthDay(new Date(d))}: ${data[d] || 0} contributions`
        ); // 显示日期和贡献数量
    }
  }, [data, containerWidth]);

  return <svg ref={svgRef}></svg>;
};

export default Heatmap;
