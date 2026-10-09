import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { get } from '@/utils/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AiUsageTotals from './AiUsageTotals';
import AiUsageModels from './AiUsageModels';
import { aiUsageRange, formatTokenCount, type AiUsagePeriod } from './range';
import type { AiUsageStatistics } from './types';

export default function AiUsagePanel() {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const [period, setPeriod] = useState<AiUsagePeriod>('30d');
  const [range, setRange] = useState(() => aiUsageRange('30d'));
  const [type, setType] = useState('all');
  const [model, setModel] = useState('');
  const query = new URLSearchParams({ ...range, type, ...(model ? { model } : {}) });
  const { data, error, isLoading, mutate } = useSWR<AiUsageStatistics>(
    `/admin/stats/ai-usage?${query}`,
    async (url: string) => (await get(url)).data
  );
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(value));

  return (
    <section className="space-y-3">
      <h3 className="font-medium">{t('title')}</h3>
      <p className="text-muted-foreground text-xs">{t('description')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs">
          <span className="block">{t('period')}</span>
          <select
            className="bg-background rounded-md border px-3 py-2"
            value={period}
            onChange={(event) => {
              const next = event.target.value as AiUsagePeriod;
              setPeriod(next);
              setRange(aiUsageRange(next));
            }}
          >
            {(['7d', '30d', 'month'] as const).map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block">{t('type')}</span>
          <select
            className="bg-background rounded-md border px-3 py-2"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setModel('');
            }}
          >
            {['all', 'chat', 'embedding'].map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block">{t('model')}</span>
          <select
            className="bg-background max-w-72 rounded-md border px-3 py-2"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            <option value="">{t('all')}</option>
            {(data?.availableModels ?? (model ? [model] : [])).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-md border px-3 py-2 text-xs"
          onClick={() => {
            const next = aiUsageRange(period);
            if (next.endAt === range.endAt) void mutate();
            else setRange(next);
          }}
        >
          {t('refresh')}
        </button>
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
          <p className="text-muted-foreground text-xs">
            {formatDate(data.range.startAt)} – {formatDate(data.range.endAt)} ·{' '}
            {data.range.timeZone}
          </p>
          <AiUsageTotals metrics={data.summary} />
          <p className="text-muted-foreground text-xs">
            {t('coverage', {
              percent: data.summary.calls
                ? `${((100 * data.summary.reportedCalls) / data.summary.calls).toFixed(1)}%`
                : t('unknown'),
              legacy: data.summary.legacyRecords,
              failed: data.summary.failedCalls,
              cancelled: data.summary.cancelledCalls,
            })}
          </p>
          <AiUsageModels models={data.models} />
          <p className="text-muted-foreground text-xs">{t('subsets')}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('topUsers')}</h4>
              <div className="overflow-x-auto rounded-md border">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('user')}</TableHead>
                      <TableHead>{t('totalTokens')}</TableHead>
                      <TableHead>{t('calls')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <a
                            className="hover:underline"
                            href={`/${user.username}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {user.username}
                          </a>
                        </TableCell>
                        <TableCell>{formatTokenCount(user.metrics.totalTokens)}</TableCell>
                        <TableCell>{user.metrics.calls.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!data.topUsers.length && (
                      <TableRow>
                        <TableCell colSpan={3}>{t('empty')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <h4 className="font-medium">{t('system')}</h4>
              <p>
                {t('groupUsage', {
                  tokens: formatTokenCount(data.system.totalTokens),
                  calls: data.system.calls,
                  unknown: data.system.unknownCalls,
                })}
              </p>
              <h4 className="font-medium">{t('unattributed')}</h4>
              <p>
                {t('groupUsage', {
                  tokens: formatTokenCount(data.unattributed.totalTokens),
                  calls: data.unattributed.calls,
                  unknown: data.unattributed.unknownCalls,
                })}
              </p>
              <p className="text-muted-foreground text-xs">{t('detailNote')}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
