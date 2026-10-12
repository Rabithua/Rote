import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { History, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  aiConversationViewAtom,
  deleteAiConversation,
  keepAiConversationCopy,
  importLegacyAiConversation,
  newAiConversation,
  retryAiConversationSync,
  selectAiConversation,
} from './runtime';

export function AiConversationControls({
  isSending,
  hasMessages,
}: {
  isSending: boolean;
  hasMessages: boolean;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory.history' });
  const view = useAtomValue(aiConversationViewAtom);
  const history = view.conversations.filter((conversation) => conversation.messages.length);
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('title')}
            title={t('title')}
            disabled={!history.length}
          >
            <History className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
          {history.map((conversation) => (
            <DropdownMenuItem
              key={conversation.id}
              onSelect={() => selectAiConversation(conversation.id)}
              className={conversation.id === view.selectedId ? 'bg-accent' : ''}
            >
              <span className="truncate">
                {conversation.messages.find((message) => message.role === 'user')?.content ||
                  t('untitled')}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={newAiConversation}
        aria-label={t('new')}
        title={t('new')}
        disabled={!view.scopeKey}
      >
        <Plus className="size-4" />
      </Button>
      {hasMessages && !isSending && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={deleteAiConversation}
          aria-label={t('delete')}
          title={t('delete')}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function AiConversationSyncStatus() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory.history' });
  const view = useAtomValue(aiConversationViewAtom);
  if (!view.isLoading && !view.issue && !view.hasPending && !view.hasLegacy) return null;
  return (
    <div className="text-info flex flex-wrap items-center gap-2 px-4 py-2 text-xs" role="status">
      {(view.isLoading || view.issue || view.hasPending) && (
        <span>{view.isLoading ? t('loading') : view.issue ? t(view.issue) : t('saving')}</span>
      )}
      {view.hasLegacy && (
        <button
          type="button"
          className="underline"
          disabled={!view.canImportLegacy}
          onClick={importLegacyAiConversation}
        >
          {t('importLegacy')}
        </button>
      )}
      {view.issue && view.issue !== 'conflict' && (
        <button type="button" className="underline" onClick={() => void retryAiConversationSync()}>
          {t('retry')}
        </button>
      )}
      {view.canKeepCopy && (
        <button type="button" className="underline" onClick={keepAiConversationCopy}>
          {t('keepCopy')}
        </button>
      )}
    </div>
  );
}
