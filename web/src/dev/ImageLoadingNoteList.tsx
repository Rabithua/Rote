import RoteList from '@/components/rote/roteList';
import type { Rote } from '@/types/main';

export function ImageLoadingNoteList({ replay, label }: { replay: string; label: string }) {
  const notes: Rote[] = Array.from({ length: 8 }, (_, index) => {
    const url = `/__image-loading__/long-list-${index}.svg?replay=${replay}&delay=6000`;
    return {
      id: `preview-list-${index}`,
      content: `${label} ${index + 1}`,
      tags: [],
      state: 'private',
      archived: false,
      pin: false,
      author: { username: 'preview', nickname: label, avatar: '' },
      createdAt: '2026-10-11T00:00:00Z',
      updatedAt: '2026-10-11T00:00:00Z',
      reactions: [],
      attachments: [
        {
          id: `preview-list-image-${index}`,
          url,
          compressUrl: url,
          userid: 'preview',
          roteid: `preview-list-${index}`,
          sortIndex: 0,
          storage: 'preview',
          createdAt: '',
          updatedAt: '',
          details: index < 2 ? {} : { width: 800, height: 600 },
        },
      ],
    };
  });
  return <RoteList data={[notes]} />;
}
