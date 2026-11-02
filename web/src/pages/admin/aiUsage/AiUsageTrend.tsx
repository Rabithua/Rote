import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatTokenCount } from './range';
import { buildDailyTokenTrend, type AiUsageTrendPoint } from './trendData';
import type { AiUsageStatistics, AiUsageTokenKey } from './types';

const SERIES = [
  {
    key: 'totalTokens',
    label: 'totalUsage',
    theme: { light: 'oklch(0.38 0.018 250)', dark: 'oklch(0.82 0.018 250)' },
  },
  {
    key: 'promptTokens',
    label: 'promptTokens',
    theme: { light: 'oklch(0.5 0.025 250)', dark: 'oklch(0.69 0.025 250)' },
  },
  {
    key: 'completionTokens',
    label: 'completionTokens',
    theme: { light: 'oklch(0.62 0.015 250)', dark: 'oklch(0.56 0.015 250)' },
  },
] as const;

export default function AiUsageTrend({ daily, range }: Pick<AiUsageStatistics, 'daily' | 'range'>) {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const [tooltipTrigger, setTooltipTrigger] = useState<'click' | 'hover'>('hover');
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const points = buildDailyTokenTrend(daily, range);
  const chartConfig = Object.fromEntries(
    SERIES.map(({ key, label, theme }) => [key, { label: t(label), theme }])
  ) satisfies ChartConfig;
  const formatDay = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  });
  const formatDate = (value: string) => formatDay.format(new Date(`${value}T00:00:00+08:00`));

  return (
    <Card className="min-w-0 pt-0 shadow-none">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{t('trendTitle')}</CardTitle>
          <CardDescription>{t('trendDescription')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {daily.length === 0 || points.length === 0 ? (
          <div className="text-muted-foreground flex h-[250px] items-center justify-center px-4 text-sm">
            {t('trendEmpty')}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart
              accessibilityLayer
              aria-label={t('trendChartLabel')}
              data={points}
              margin={{ top: 8, right: 12, bottom: 0, left: 12 }}
              onClick={() => setTooltipTrigger('click')}
              onMouseMove={() => setTooltipTrigger('hover')}
              onTouchMove={() => setTooltipTrigger('hover')}
            >
              <defs>
                {SERIES.map(({ key }) => (
                  <linearGradient key={key} id={`${gradientId}-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatDate}
              />
              <YAxis hide domain={[0, 'auto']} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                trigger={tooltipTrigger}
                filterNull={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    className="max-w-64"
                    labelFormatter={(label, payload) => {
                      const point = payload[0]?.payload as AiUsageTrendPoint | undefined;
                      return (
                        <div className="grid gap-1.5">
                          <span>{formatDate(String(label))}</span>
                          {(point?.metrics?.unknownCalls ?? 0) > 0 && (
                            <span className="text-muted-foreground max-w-52 font-normal">
                              {t('trendUnknown', { count: point!.metrics!.unknownCalls })}
                            </span>
                          )}
                        </div>
                      );
                    }}
                    formatter={(_value, _name, item) => {
                      const key = item.dataKey as AiUsageTokenKey;
                      const point = item.payload as AiUsageTrendPoint;
                      return (
                        <>
                          <div
                            className="size-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: `var(--color-${key})` }}
                          />
                          <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">{chartConfig[key]?.label}</span>
                            <span className="text-foreground font-mono font-medium tabular-nums">
                              {point[key] === null
                                ? t('unknown')
                                : formatTokenCount(point.metrics?.[key] ?? '0')}
                            </span>
                          </div>
                        </>
                      );
                    }}
                  />
                }
              />
              {SERIES.map(({ key }) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="monotone"
                  fill={`url(#${gradientId}-${key})`}
                  stroke={`var(--color-${key})`}
                  dot={{ r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: 'var(--background)', strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
              <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
