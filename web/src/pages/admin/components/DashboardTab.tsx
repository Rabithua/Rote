import AiUsagePanel from '../aiUsage/AiUsagePanel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { get } from '@/utils/api';
import { formatBytes } from '@/utils/main';
import { Activity, AlertTriangle, HardDrive, Loader, ServerCrash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import type { DashboardStats } from '../types';

function MetricBlock({
  label,
  value,
}: {
  label: string;
  value: string | number | React.ReactNode;
}) {
  return (
    <div className="bg-muted/20 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

export default function DashboardTab() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard' });

  const { data, isLoading } = useSWR<DashboardStats>(
    '/admin/stats/dashboard',
    async (url: string) => {
      const res = await get(url);
      return res.data as DashboardStats;
    }
  );

  if (isLoading) {
    return (
      <Card className="rounded-none border-none shadow-none">
        <CardHeader className="pb-0">
          <CardTitle>{t('title', 'Data Dashboard')}</CardTitle>
          <CardDescription>
            {t('description', 'Overview of platform statistics and anomaly detection')}
          </CardDescription>
        </CardHeader>
        <Divider />
        <CardContent className="flex items-center justify-center py-12">
          <Loader className="text-muted-foreground size-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { globalStats, topUsersByNotes, topUsersByApi, topUsersByStorage } = data;

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader className="pb-0">
        <CardTitle>{t('title', 'Data Dashboard')}</CardTitle>
        <CardDescription>
          {t('description', 'Overview of platform statistics and anomaly detection')}
        </CardDescription>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-6">
        <section className="grid gap-3 md:grid-cols-4">
          <MetricBlock
            label={t('stats.users', 'Total Users')}
            value={globalStats.users.toLocaleString()}
          />
          <MetricBlock
            label={t('stats.rotes', 'Total Notes')}
            value={globalStats.rotes.toLocaleString()}
          />
          <MetricBlock
            label={t('stats.attachments', 'Attachments')}
            value={globalStats.attachments.toLocaleString()}
          />
          <MetricBlock
            label={t('stats.aiPending', 'AI Pending Jobs')}
            value={
              <div className="flex items-center justify-between">
                <span>{globalStats.embeddingJobs.pending.toLocaleString()}</span>
                {globalStats.embeddingJobs.failed > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1 text-[10px]">
                    {globalStats.embeddingJobs.failed} Failed
                  </Badge>
                )}
              </div>
            }
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Top Note Creators */}
          <section className="flex h-full flex-col space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4" />
              <h3 className="font-medium">{t('tables.topCreators', 'Top Content Creators')}</h3>
            </div>

            <div className="h-[260px] overflow-auto rounded-md border">
              <Table className="text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.username', 'Username')}</TableHead>
                    <TableHead className="text-right">{t('table.notes', 'Notes')}</TableHead>
                    <TableHead className="text-right">{t('table.articles', 'Articles')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsersByNotes.slice(0, 10).map((user) => (
                    <TableRow
                      key={user.id}
                      className={user.roteCount > 1000 ? 'bg-red-500/10' : ''}
                    >
                      <TableCell
                        className="cursor-pointer font-medium hover:underline"
                        onClick={() => window.open(`/${user.username}`, '_blank')}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarImage src={user.avatar || undefined} alt={user.username} />
                            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{user.username}</span>
                          {user.roteCount > 1000 && (
                            <AlertTriangle className="size-3 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {user.roteCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.articleCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topUsersByNotes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                        {t('empty.noData', 'No data')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Top API Users */}
          <section className="flex h-full flex-col space-y-3">
            <div className="flex items-center gap-2">
              <ServerCrash className="size-4" />
              <h3 className="font-medium">{t('tables.topApi', 'High API Usage (7 days)')}</h3>
            </div>

            <div className="h-[260px] overflow-auto rounded-md border">
              <Table className="text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.username', 'Username')}</TableHead>
                    <TableHead className="text-right">{t('table.apiCalls', 'API Calls')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsersByApi.slice(0, 10).map((user) => (
                    <TableRow
                      key={user.id}
                      className={user.apiCallCount > 5000 ? 'bg-red-500/10' : ''}
                    >
                      <TableCell
                        className="cursor-pointer font-medium hover:underline"
                        onClick={() => window.open(`/${user.username}`, '_blank')}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarImage src={user.avatar || undefined} alt={user.username} />
                            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{user.username}</span>
                          {user.apiCallCount > 5000 && (
                            <AlertTriangle className="size-3 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {user.apiCallCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topUsersByApi.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground py-6 text-center">
                        {t('empty.noApiUsage', 'No API usage in the last 7 days')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Top Storage Users */}
          <section className="flex h-full flex-col space-y-3">
            <div className="flex items-center gap-2">
              <HardDrive className="size-4" />
              <h3 className="font-medium">{t('tables.topStorage', 'Top Storage Usage')}</h3>
            </div>

            <div className="h-[260px] overflow-auto rounded-md border">
              <Table className="text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.username', 'Username')}</TableHead>
                    <TableHead className="text-right">
                      {t('table.storage', 'Storage Used')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsersByStorage?.slice(0, 10).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell
                        className="cursor-pointer font-medium hover:underline"
                        onClick={() => window.open(`/${user.username}`, '_blank')}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarImage src={user.avatar || undefined} alt={user.username} />
                            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatBytes(Number(user.storageUsage))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!topUsersByStorage || topUsersByStorage.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground py-6 text-center">
                        {t('empty.noStorageUsage', 'No storage usage yet')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
        <AiUsagePanel />
      </CardContent>
    </Card>
  );
}
