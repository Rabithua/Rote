import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatTokenCount } from './range';
import type { AiUsageStatistics } from './types';

export default function AiUsageNotes({ data }: { data: AiUsageStatistics }) {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const [expanded, setExpanded] = useState(false);
  const notesId = useId();
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(value));

  return (
    <Card className="rounded-md shadow-none">
      <Button
        variant="ghost"
        className="w-full justify-between"
        aria-expanded={expanded}
        aria-controls={notesId}
        onClick={() => setExpanded(!expanded)}
      >
        {t('statisticsNotes')}
        <ChevronDown className={expanded ? 'rotate-180' : ''} aria-hidden="true" />
      </Button>
      <CardContent id={notesId} hidden={!expanded} className="space-y-4 border-t p-4">
        <p className="text-muted-foreground text-xs">{t('description')}</p>
        <p className="text-muted-foreground text-xs">
          {formatDate(data.range.startAt)} – {formatDate(data.range.endAt)} · {data.range.timeZone}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <p>
            {t('reportedCalls')}: {data.summary.reportedCalls.toLocaleString()}
          </p>
          <p>
            {t('unknownCalls')}: {data.summary.unknownCalls.toLocaleString()}
          </p>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {data.models.map(({ providerId, model, type, metrics }) => (
            <div key={JSON.stringify([providerId, model, type])} className="space-y-1 text-xs">
              <p className="font-medium break-all">
                {model} · {t(type)}
              </p>
              <p className="text-muted-foreground break-all">{providerId ?? t('legacyProvider')}</p>
              <p className="text-muted-foreground">
                {t('legacyCount', { count: metrics.legacyRecords })}
              </p>
              {(['cacheHit', 'cacheMiss', 'reasoning'] as const).map((key) => (
                <p key={key}>
                  {t(key)}: {formatTokenCount(metrics[`${key}Tokens`]) ?? t('unknown')}
                  {metrics[`${key}Tokens`] !== null && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {t('detailCoverage', { count: metrics[`${key}ReportedCalls`] })}
                    </span>
                  )}
                </p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('subsets')}</p>
        <div className="grid gap-4 text-sm lg:grid-cols-2">
          {(['system', 'unattributed'] as const).map((group) => (
            <div key={group} className="space-y-2">
              <h4 className="font-medium">{t(group)}</h4>
              <p>
                {t('groupUsage', {
                  tokens: formatTokenCount(data[group].totalTokens),
                  calls: data[group].calls,
                  unknown: data[group].unknownCalls,
                })}
              </p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('detailNote')}</p>
      </CardContent>
    </Card>
  );
}
