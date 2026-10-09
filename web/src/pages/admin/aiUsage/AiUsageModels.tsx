import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AiUsageStatistics } from './types';
import { formatTokenCount } from './range';

export default function AiUsageModels({ models }: { models: AiUsageStatistics['models'] }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[760px] text-xs whitespace-nowrap">
        <TableHeader>
          <TableRow>
            {[
              'model',
              'type',
              'calls',
              'promptTokens',
              'completionTokens',
              'totalTokens',
              'details',
            ].map((key) => (
              <TableHead key={key}>{t(key)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map(({ providerId, model, type, metrics }) => (
            <TableRow key={JSON.stringify([providerId, model, type])}>
              <TableCell className="font-medium">
                {model}
                <div className="text-muted-foreground">{providerId ?? t('legacyProvider')}</div>
              </TableCell>
              <TableCell>{t(type)}</TableCell>
              <TableCell>
                {metrics.calls.toLocaleString()}
                <div className="text-muted-foreground">
                  {t('legacyCount', { count: metrics.legacyRecords })}
                </div>
              </TableCell>
              <TableCell>{formatTokenCount(metrics.promptTokens)}</TableCell>
              <TableCell>{formatTokenCount(metrics.completionTokens)}</TableCell>
              <TableCell>{formatTokenCount(metrics.totalTokens)}</TableCell>
              <TableCell className="min-w-48">
                {(['cacheHit', 'cacheMiss', 'reasoning'] as const).map((key) => (
                  <div key={key}>
                    {t(key)}: {formatTokenCount(metrics[`${key}Tokens`]) ?? t('unknown')}
                    {metrics[`${key}Tokens`] !== null && (
                      <span className="text-muted-foreground">
                        {' '}
                        · {t('detailCoverage', { count: metrics[`${key}ReportedCalls`] })}
                      </span>
                    )}
                  </div>
                ))}
              </TableCell>
            </TableRow>
          ))}
          {!models.length && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                {t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
