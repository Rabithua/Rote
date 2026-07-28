import {
  createRote,
  deleteEmbeddingsForSource,
  deleteRote,
  deleteRoteAttachmentsByRoteId,
  deleteRoteLinkPreviewsByRoteId,
  editRote,
  enqueueEmbeddingJob,
  findRoteById,
  setNoteArticleId,
} from '../utils/dbMethods';
import { extractUrlsFromContent, parseAndStoreRoteLinkPreviews } from '../utils/linkPreview';
import { trackBackgroundTask } from '../utils/backgroundTask';

type CreateUserNoteInput = {
  content: string;
  title?: string;
  state?: string;
  type?: string;
  tags: string[];
  pin?: boolean;
  archived?: boolean;
  editor?: string;
  articleId?: string | null;
  articleIds?: string[];
};

type UpdateUserNoteInput = Record<string, any> & {
  articleId?: string | null;
  articleIds?: string[];
};

function firstArticleId(input: { articleId?: unknown; articleIds?: unknown }): string | null {
  if (typeof input.articleId === 'string') return input.articleId;
  if (Array.isArray(input.articleIds) && input.articleIds.length > 0) return input.articleIds[0];
  return null;
}

export async function createUserNote(userId: string, input: CreateUserNoteInput) {
  const result = await createRote({
    content: input.content,
    title: input.title || '',
    state: input.state || 'private',
    type: input.type || 'rote',
    tags: input.tags,
    pin: !!input.pin,
    archived: !!input.archived,
    editor: input.editor,
    authorid: userId,
  });

  trackBackgroundTask(
    enqueueEmbeddingJob('rote', result.id, userId),
    'rote_embedding_enqueue_failed'
  );

  const articleId = firstArticleId(input);
  if (articleId) {
    await setNoteArticleId(result.id, articleId, userId);
    return result;
  }

  trackBackgroundTask(
    parseAndStoreRoteLinkPreviews(result.id, result.content),
    'link_preview_create_failed'
  );
  return result;
}

export async function updateUserNote(userId: string, id: string, input: UpdateUserNoteInput) {
  await editRote({ ...input, id, authorid: userId });
  trackBackgroundTask(enqueueEmbeddingJob('rote', id, userId), 'rote_embedding_enqueue_failed');

  let articleIdToSet: string | null | undefined;
  if ('articleId' in input) {
    articleIdToSet =
      typeof input.articleId === 'string' ? input.articleId : (input.articleId ?? null);
  } else if (Array.isArray(input.articleIds)) {
    articleIdToSet = input.articleIds.length > 0 ? input.articleIds[0] : null;
  }

  if (articleIdToSet !== undefined) {
    await setNoteArticleId(id, articleIdToSet, userId);
  }

  const data = await findRoteById(id, userId);
  const hasArticle = Boolean(data?.articleId || data?.article);
  const contentProvided = Object.prototype.hasOwnProperty.call(input, 'content');
  const contentForPreview = contentProvided ? input.content : data?.content;

  if (hasArticle && articleIdToSet !== undefined) {
    await deleteRoteLinkPreviewsByRoteId(id);
  } else if (
    (contentProvided || articleIdToSet !== undefined) &&
    typeof contentForPreview === 'string'
  ) {
    const urls = extractUrlsFromContent(contentForPreview);
    await deleteRoteLinkPreviewsByRoteId(id);
    if (urls.length > 0 && !hasArticle) {
      trackBackgroundTask(
        parseAndStoreRoteLinkPreviews(id, contentForPreview),
        'link_preview_update_failed'
      );
    }
  }

  return data;
}

export async function deleteUserNote(userId: string, id: string) {
  const data = await deleteRote({ id, authorid: userId });
  await deleteRoteAttachmentsByRoteId(id, userId);
  trackBackgroundTask(deleteEmbeddingsForSource('rote', id), 'rote_embedding_delete_failed');
  return data;
}
