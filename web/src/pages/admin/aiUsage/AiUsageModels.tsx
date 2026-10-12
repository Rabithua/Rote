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
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>{t('modelName')}</TableHead>
            <TableHead className="text-right whitespace-normal">{t('usage')}</TableHead>
            <TableHead className="text-right whitespace-normal">{t('calls')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map(({ providerId, model, type, metrics }) => (
            <TableRow key={JSON.stringify([providerId, model, type])}>
              <TableCell className="font-medium break-all whitespace-normal">
                {model}
                <div className="text-muted-foreground text-xs font-normal">{t(type)}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatTokenCount(metrics.totalTokens)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {metrics.calls.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {!models.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                {t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
