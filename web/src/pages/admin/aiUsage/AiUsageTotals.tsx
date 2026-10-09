import { useTranslation } from 'react-i18next';
import type { AiUsageMetrics } from './types';
import { formatTokenCount } from './range';

export default function AiUsageTotals({ metrics }: { metrics: AiUsageMetrics }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const items = [
    ['totalTokens', formatTokenCount(metrics.totalTokens)],
    ['promptTokens', formatTokenCount(metrics.promptTokens)],
    ['completionTokens', formatTokenCount(metrics.completionTokens)],
    ['calls', metrics.calls.toLocaleString()],
    ['reportedCalls', metrics.reportedCalls.toLocaleString()],
    ['unknownCalls', metrics.unknownCalls.toLocaleString()],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="bg-muted/20 rounded-md border px-3 py-2">
          <p className="text-muted-foreground text-xs">{t(label!)}</p>
          <p className="mt-1 text-sm font-medium break-all">{value}</p>
        </div>
      ))}
    </div>
  );
}
