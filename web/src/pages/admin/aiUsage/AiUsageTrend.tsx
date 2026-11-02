import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTokenCount } from './range';
import { buildDailyTokenTrend, type AiUsageTrendPoint } from './trendData';
import type { AiUsageStatistics } from './types';

const SERIES = [
  { key: 'totalTokens', label: 'totalUsage', color: 'var(--chart-1)', dash: undefined },
  { key: 'promptTokens', label: 'promptTokens', color: 'var(--chart-2)', dash: '6 3' },
  { key: 'completionTokens', label: 'completionTokens', color: 'var(--chart-3)', dash: '2 3' },
] as const;

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const point = payload?.[0]?.payload as AiUsageTrendPoint | undefined;
  if (!active || !point) return null;
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(`${point.date}T00:00:00+08:00`));
  return (
    <div className="bg-popover text-popover-foreground max-w-64 space-y-2 rounded-md border p-3 text-xs shadow-md">
      <p className="font-medium">{date}</p>
      <dl className="space-y-1.5">
        {SERIES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              {t(label)}
            </dt>
            <dd className="font-medium tabular-nums">
              {point[key] === null ? t('unknown') : formatTokenCount(point.metrics?.[key] ?? '0')}
            </dd>
          </div>
        ))}
      </dl>
      {(point.metrics?.unknownCalls ?? 0) > 0 && (
        <p className="text-muted-foreground max-w-52">
          {t('trendUnknown', { count: point.metrics!.unknownCalls })}
        </p>
      )}
    </div>
  );
}

export default function AiUsageTrend({ daily, range }: Pick<AiUsageStatistics, 'daily' | 'range'>) {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const [tooltipTrigger, setTooltipTrigger] = useState<'click' | 'hover'>('hover');
  const points = buildDailyTokenTrend(daily, range);
  const formatAxis = new Intl.NumberFormat(i18n.language, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const formatDay = new Intl.DateTimeFormat(i18n.language, {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  });
  return (
    <Card className="min-w-0 rounded-md shadow-none">
      <CardHeader className="gap-2 p-4 pb-2">
        <CardTitle className="text-sm">{t('trendTitle')}</CardTitle>
        <CardDescription className="text-xs">{t('trendDescription')}</CardDescription>
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
          {SERIES.map(({ key, label, color, dash }) => (
            <span key={key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-4 border-t-2"
                style={{ borderColor: color, borderStyle: dash ? 'dashed' : 'solid' }}
              />
              {t(label)}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-3 sm:px-4">
        {daily.length === 0 || points.length === 0 ? (
          <div className="text-muted-foreground flex h-64 items-center justify-center px-4 text-sm">
            {t('trendEmpty')}
          </div>
        ) : (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={points}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer
                aria-label={t('trendChartLabel')}
                onClick={() => setTooltipTrigger('click')}
                onMouseMove={() => setTooltipTrigger('hover')}
                onTouchMove={() => setTooltipTrigger('hover')}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickMargin={10}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  tickFormatter={(date: string) =>
                    formatDay.format(new Date(`${date}T00:00:00+08:00`))
                  }
                />
                <YAxis
                  width={48}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                  allowDecimals={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  tickFormatter={(value: number) => formatAxis.format(value)}
                />
                <Tooltip
                  content={TrendTooltip}
                  trigger={tooltipTrigger}
                  filterNull={false}
                  cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                />
                {SERIES.map(({ key, color, dash }) => (
                  <Line
                    key={key}
                    type="linear"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={dash}
                    dot={{ r: 2, strokeWidth: 0 }}
                    activeDot={{ r: 4, stroke: 'var(--background)', strokeWidth: 2 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState } from 'react';
