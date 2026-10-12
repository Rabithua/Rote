import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpRight, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { DashboardStats } from '../types';
import { formatTokenCount } from './range';

export default function AiUsageRanking({
  users,
}: {
  users: DashboardStats['topUsersByTokenUsage'];
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.dashboard' });

  return (
    <Link
      to="/admin/ai-usage"
      aria-label={t('aiUsage.viewDetails')}
      className="group focus-visible:ring-ring flex h-full flex-col space-y-3 rounded-md outline-none focus-visible:ring-2"
    >
      <div className="flex items-center gap-2">
        <Brain className="size-4 shrink-0" />
        <h3 className="flex-1 font-medium">{t('tables.topTokenUsage')}</h3>
        <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1 text-xs">
          {t('aiUsage.viewDetails')}
          <ArrowUpRight className="size-3 shrink-0" />
        </span>
      </div>
      <div className="group-hover:bg-muted/20 h-[260px] overflow-auto rounded-md border transition-colors">
        <Table className="text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3">
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.username')}</TableHead>
              <TableHead className="text-right">{t('table.tokenUsage')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.slice(0, 10).map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarImage src={user.avatar || undefined} alt={user.username} />
                      <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{user.username}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatTokenCount(String(user.tokenUsage))}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground py-6 text-center">
                  {t('empty.noTokenUsage')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Link>
  );
}
