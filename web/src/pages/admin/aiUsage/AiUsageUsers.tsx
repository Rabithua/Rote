import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { get } from '@/utils/api';
import { formatTokenCount } from './range';
import type { AiUsageStatistics, AiUsageUsersResponse } from './types';

export default function AiUsageUsers({
  range,
}: {
  range: Pick<AiUsageStatistics['range'], 'startAt' | 'endAt'>;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard.aiUsage' });
  const { t: paginationT } = useTranslation('translation', {
    keyPrefix: 'pages.admin.users.pagination',
  });
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ ...range, type: 'all', page: String(page), limit: '20' });
  const { data, error, isLoading, isValidating } = useSWR<AiUsageUsersResponse>(
    `/admin/stats/ai-usage/users?${query}`,
    async (url: string) => (await get(url)).data,
    { keepPreviousData: true }
  );

  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-sm font-medium">{t('users')}</h3>
      {isLoading && !data && (
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
          <div className="overflow-x-auto rounded-md border" aria-busy={isValidating}>
            <Table className="min-w-[600px] text-sm whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('user')}</TableHead>
                  {(['usage', 'promptTokens', 'completionTokens', 'calls'] as const).map((key) => (
                    <TableHead key={key} className="text-right">
                      {t(key)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <a
                        className="inline-flex items-center gap-2 hover:underline"
                        href={`/${user.username}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Avatar aria-hidden="true">
                          <AvatarImage src={user.avatar || undefined} alt="" />
                          <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{user.username}</span>
                      </a>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatTokenCount(user.metrics.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTokenCount(user.metrics.promptTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTokenCount(user.metrics.completionTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {user.metrics.calls.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!data.users.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data.pagination.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {paginationT('showing', {
                  start: (data.pagination.page - 1) * data.pagination.limit + 1,
                  end: Math.min(
                    data.pagination.page * data.pagination.limit,
                    data.pagination.total
                  ),
                  total: data.pagination.total,
                })}
              </p>
              {data.pagination.pages > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isValidating || page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {paginationT('previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isValidating || page >= data.pagination.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    {paginationT('next')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
