import UserAvatar from '@/components/others/UserAvatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { profileAtom } from '@/state/profile';
import type { RoteComment } from '@/types/main';
import { formatTimeAgo } from '@/utils/main';
import { createRoteComment, deleteRoteComment, getRoteComments } from '@/utils/commentApi';
import { useAPIGet } from '@/utils/fetcher';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

function CommentsSection({ roteId }: { roteId: string }) {
  const profile = useAtomValue(profileAtom);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<RoteComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: comments, isLoading, mutate } = useAPIGet(
    ['comments', roteId],
    () => getRoteComments(roteId),
    {
      revalidateOnFocus: false,
    }
  );

  const canDeleteComment = (comment: RoteComment) => {
    if (!profile) return false;
    if (profile.id === comment.userid) return true;
    return profile.role === 'admin' || profile.role === 'moderator' || profile.role === 'super_admin';
  };

  const handleSubmit = async () => {
    if (!profile) {
      toast.error('请先登录后再回复');
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('回复内容不能为空');
      return;
    }

    try {
      setIsSubmitting(true);
      await createRoteComment(roteId, {
        content: trimmed,
        parentId: replyTo?.id ?? null,
      });
      setContent('');
      setReplyTo(null);
      mutate();
    } catch (error: any) {
      toast.error(error?.message || '回复失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteRoteComment(roteId, commentId);
      mutate();
    } catch (error: any) {
      toast.error(error?.message || '删除失败');
    }
  };

  const renderComment = (comment: RoteComment, depth = 0) => (
    <div
      key={comment.id}
      className={`mt-3 ${depth > 0 ? 'border-foreground/10 ml-6 border-l pl-4' : ''}`}
    >
      <div className="flex gap-3">
        <UserAvatar
          avatar={comment.user?.avatar || null}
          className="bg-foreground/5 text-primary size-7"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            {comment.user?.username ? (
              <Link to={`/${comment.user.username}`} className="font-semibold hover:underline">
                {comment.user.nickname || comment.user.username}
              </Link>
            ) : (
              <span className="font-semibold">匿名</span>
            )}
            <span className="text-info text-xs">{formatTimeAgo(comment.createdAt)}</span>
            {canDeleteComment(comment) && (
              <button
                className="text-info hover:text-foreground text-xs"
                onClick={() => handleDelete(comment.id)}
              >
                删除
              </button>
            )}
          </div>
          <div className="wrap-break-word whitespace-pre-wrap text-sm">{comment.content}</div>
          <div className="text-info mt-1 text-xs">
            <button
              className="hover:text-foreground"
              onClick={() => {
                setReplyTo(comment);
              }}
            >
              回复
            </button>
          </div>
        </div>
      </div>
      {comment.children?.map((child) => renderComment(child, depth + 1))}
    </div>
  );

  return (
    <div className="border-foreground/10 mt-4 border-t pt-4">
      <div className="mb-3 text-sm font-semibold">回复</div>

      <div className="flex flex-col gap-2">
        {replyTo && (
          <div className="text-info flex items-center gap-2 text-xs">
            正在回复 {replyTo.user?.nickname || replyTo.user?.username || '匿名'}
            <button className="text-foreground/80 hover:text-foreground" onClick={() => setReplyTo(null)}>
              取消
            </button>
          </div>
        )}
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={profile ? '写下你的回复...' : '登录后可回复'}
          disabled={!profile || isSubmitting}
          className="min-h-[80px]"
        />
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!profile || isSubmitting}>
            发送
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="text-info text-sm">加载中...</div>
        ) : (comments?.length || 0) === 0 ? (
          <div className="text-info text-sm">暂无回复</div>
        ) : (
          comments?.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}

export default CommentsSection;
