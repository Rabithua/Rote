import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import type { AiUsageMetrics } from './types';
import { formatTokenCount } from './range';

export default function AiUsageTotals({ metrics }: { metrics: AiUsageMetrics }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const items = [
    ['totalUsage', formatTokenCount(metrics.totalTokens)],
    ['promptTokens', formatTokenCount(metrics.promptTokens)],
    ['completionTokens', formatTokenCount(metrics.completionTokens)],
    ['calls', metrics.calls.toLocaleString()],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <Card key={label} className="rounded-md shadow-none">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">{t(label)}</p>
            <p className="mt-2 text-sm font-semibold break-all tabular-nums sm:text-lg">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
