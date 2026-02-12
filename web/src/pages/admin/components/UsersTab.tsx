import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Divider from '@/components/ui/divider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProfile } from '@/state/profile';
import { del, get, put } from '@/utils/api';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  Ellipsis,
  ExternalLink,
  Loader,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';

interface User {
  id: string;
  username: string;
  email: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

type SortField = 'createdAt' | 'username' | 'email';
type SortOrder = 'asc' | 'desc';

export default function UsersTab() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.users' });
  const profile = useProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === 'super_admin';

  // 构建查询参数
  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: '10',
    ...(searchQuery && { search: searchQuery }),
    sortField: sortField,
    sortOrder: sortOrder,
  });

  const { data, isLoading, mutate } = useSWR<UsersResponse>(
    `/admin/users?${queryParams.toString()}`,
    async (url: string) => {
      const res = await get(url);
      return res.data as UsersResponse;
    }
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // 排序改变时重置到第一页
  };

  const handleVerifyEmail = async (userId: string) => {
    setVerifyingUserId(userId);
    try {
      await put(`/admin/users/${userId}/verify-email`);
      toast.success(t('verifyEmailSuccess'));
      mutate();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('verifyEmailFailed', { error: errorMessage }));
    } finally {
      setVerifyingUserId(null);
    }
  };

  const handleUnverifyEmail = async (userId: string) => {
    setVerifyingUserId(userId);
    try {
      await put(`/admin/users/${userId}/unverify-email`);
      toast.success(t('unverifyEmailSuccess'));
      mutate();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('unverifyEmailFailed', { error: errorMessage }));
    } finally {
      setVerifyingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    setIsDeleting(true);
    try {
      await del(`/admin/users/${deleteUserId}`);
      toast.success(t('deleteSuccess'));
      mutate();
      setDeleteUserId(null);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('deleteFailed', { error: errorMessage }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // 重置到第一页
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader className="pb-0">
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <Divider />
      <CardContent className="space-y-4">
        {/* 搜索栏 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 表格 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="size-6 animate-spin" />
          </div>
        ) : !data || data.users.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            {searchQuery ? t('noUsersFound') : t('noUsers')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.avatar')}</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('username')}
                    >
                      <div className="flex items-center">
                        {t('table.username')}
                        <SortIcon field="username" />
                      </div>
                    </TableHead>
                    <TableHead>{t('table.email')}</TableHead>
                    <TableHead>{t('table.nickname')}</TableHead>
                    <TableHead>{t('table.role')}</TableHead>
                    <TableHead>{t('table.emailVerified')}</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center">
                        {t('table.createdAt')}
                        <SortIcon field="createdAt" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatar || undefined} alt={user.username} />
                          <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell
                        className="cursor-pointer font-medium hover:underline"
                        onClick={() => {
                          window.open(`/${user.username}`, '_blank');
                        }}
                      >
                        {user.username}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.nickname || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.emailVerified ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="size-3" />
                            {t('table.verified')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <X className="size-3" />
                            {t('table.unverified')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Ellipsis className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(`/${user.username}`, '_blank');
                              }}
                            >
                              <ExternalLink className="mr-2 size-4" />
                              {t('table.homepage')}
                            </DropdownMenuItem>
                            {!user.emailVerified ? (
                              <DropdownMenuItem
                                onClick={() => handleVerifyEmail(user.id)}
                                disabled={verifyingUserId === user.id}
                              >
                                {verifyingUserId === user.id ? (
                                  <Loader className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 size-4" />
                                )}
                                {t('table.verifyEmail')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleUnverifyEmail(user.id)}
                                disabled={verifyingUserId === user.id}
                              >
                                {verifyingUserId === user.id ? (
                                  <Loader className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <Ban className="mr-2 size-4" />
                                )}
                                {t('table.unverifyEmail')}
                              </DropdownMenuItem>
                            )}
                            {isSuperAdmin && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (user.role !== 'super_admin') {
                                    setDeleteUserId(user.id);
                                  }
                                }}
                                disabled={user.role === 'super_admin'}
                                variant={user.role === 'super_admin' ? 'default' : 'destructive'}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {t('table.delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            {data.pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {t('pagination.showing', {
                    start: (data.pagination.page - 1) * data.pagination.limit + 1,
                    end: Math.min(
                      data.pagination.page * data.pagination.limit,
                      data.pagination.total
                    ),
                    total: data.pagination.total,
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {t('pagination.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(data.pagination.pages, p + 1))}
                    disabled={currentPage === data.pagination.pages}
                  >
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirm.title')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)} disabled={isDeleting}>
              {t('deleteConfirm.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting && <Loader className="mr-2 size-4 animate-spin" />}
              {isDeleting ? t('deleteConfirm.deleting') : t('deleteConfirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
