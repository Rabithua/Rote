// src/Heatmap.tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { HeatMapDay } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { SquareDashed } from 'lucide-react';
import moment from 'moment';
import { useTranslation } from 'node_modules/react-i18next';
import React from 'react';
import LoadingPlaceholder from '../others/LoadingPlaceholder';

const Heatmap: React.FC = () => {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.d3.heatmap',
  });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (70 + startDate.getDay() || 7));

  const { data: heatmapData, isLoading } = useAPIGet<{
    [key: string]: number;
  }>('heatmap', () =>
    get('/users/me/heatmap', {
      startDate,
      endDate,
    }).then((res) => res.data)
  );

  const colors = ['#cccccc20', '#07C16030', '#07C16050', '#07C16070', '#07C16090', '#07C160'];

  const daysOfWeek = [
    t('daysOfWeek.Sun'),
    t('daysOfWeek.Mon'),
    t('daysOfWeek.Tue'),
    t('daysOfWeek.Wed'),
    t('daysOfWeek.Thu'),
    t('daysOfWeek.Fri'),
    t('daysOfWeek.Sat'),
  ];

  function parseDays(data: { [key: string]: number } | undefined): HeatMapDay[][] {
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
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // 按周几分成小数组，并带上当天的笔记个数
    const weeks = [];
    let currentWeek: HeatMapDay[] = [];

    dates.forEach((date) => {
      const dateString = date.toISOString().split('T')[0];
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

  return (
    <>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : heatmapData && Object.keys(heatmapData).length === 0 ? (
        <div className="shrink-0 py-4">
          <div className="text-info flex w-full flex-col items-center justify-center gap-4 py-4 text-sm font-light">
            <SquareDashed className="text-theme/30 size-8" />
            {t('noData')}
          </div>
        </div>
      ) : (
        <div className="flex gap-2 p-4">
          <div className="flex shrink-0 flex-col justify-around">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-primary/70 text-right text-xs">
                {day}
              </div>
            ))}
          </div>
          <div className="noScrollBar flex gap-1.5 overflow-y-scroll md:gap-1">
            {parseDays(heatmapData).map((week: HeatMapDay[], index: number) => (
              <div key={`week_${index}`} className="flex flex-col gap-1.5 md:gap-1">
                {week.map((day: HeatMapDay, dayIndex: number) => (
                  <Tooltip key={dayIndex}>
                    <TooltipTrigger asChild>
                      <div
                        className="size-5 cursor-pointer rounded-xs duration-300 hover:scale-105 md:size-4"
                        style={{
                          backgroundColor: day.notesCount
                            ? colors[Math.min(day.notesCount, colors.length - 1)]
                            : colors[0],
                        }}
                      ></div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <div>{moment.utc(day.date).format('YYYY/MM/DD')}</div>
                        <div className="text-xs opacity-80">
                          {day.notesCount} {day.notesCount === 1 ? t('note') : t('notes')}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
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
