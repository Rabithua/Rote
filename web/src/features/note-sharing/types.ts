import type { AttachmentMedia, LinkPreview } from '@/types/main';

export type NoteShareLink = { token: string; createdAt: string };

export type SharedNote = {
  title: string | null;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author: { username: string; nickname: string | null; avatar: string | null };
  attachments: AttachmentMedia[];
  article: { content: string; createdAt: string; updatedAt: string } | null;
  linkPreviews: Pick<
    LinkPreview,
    'id' | 'url' | 'title' | 'description' | 'image' | 'contentExcerpt'
  >[];
};
