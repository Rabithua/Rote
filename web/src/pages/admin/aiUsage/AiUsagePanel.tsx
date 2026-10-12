import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { get } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AiUsageNotes from './AiUsageNotes';
import AiUsageTotals from './AiUsageTotals';
import AiUsageModels from './AiUsageModels';
import AiUsageUsers from './AiUsageUsers';
import { aiUsageRange, type AiUsagePeriod } from './range';
import type { AiUsageStatistics } from './types';

export default function AiUsagePanel() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const [period, setPeriod] = useState<AiUsagePeriod>('30d');
  const [range, setRange] = useState(() => aiUsageRange('30d'));
  const [refreshKey, setRefreshKey] = useState(0);
  const query = new URLSearchParams({ ...range, type: 'all' });
  const { data, error, isLoading, mutate } = useSWR<AiUsageStatistics>(
    `/admin/stats/ai-usage?${query}`,
    async (url: string) => (await get(url)).data
  );
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Label htmlFor="ai-usage-period" className="text-xs">
            {t('period')}
          </Label>
          <Select
            value={period}
            onValueChange={(value) => {
              const next = value as AiUsagePeriod;
              setPeriod(next);
              setRange(aiUsageRange(next));
            }}
          >
            <SelectTrigger id="ai-usage-period" size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['7d', '30d', 'month'] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next = aiUsageRange(period);
            if (next.endAt === range.endAt) {
              void mutate();
              setRefreshKey((key) => key + 1);
            } else setRange(next);
          }}
        >
          {t('refresh')}
        </Button>
      </div>
      {isLoading && (
        <p role="status" className="text-muted-foreground text-sm">
          {t('loading')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {t('error')}
        </p>
      )}
      {data && (
        <>
          <AiUsageTotals metrics={data.summary} />
          <AiUsageUsers key={`${range.startAt}:${range.endAt}:${refreshKey}`} range={range} />
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-medium">{t('modelUsage')}</h3>
            <AiUsageModels models={data.models} />
          </div>
          <AiUsageNotes data={data} />
        </>
      )}
    </section>
  );
}
