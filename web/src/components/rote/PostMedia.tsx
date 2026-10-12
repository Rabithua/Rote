import type { AttachmentMedia } from '@/types/main';
import { PhotoProvider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { MediaRail } from './MediaRail';
import { SingleMedia } from './SingleMedia';
import { postMediaItem } from './postMediaModel';
import './PostMedia.css';

type PostMediaProps = {
  attachments: AttachmentMedia[];
  withTimeStamp?: boolean;
  avatarInset?: boolean;
};

export default function PostMedia({
  attachments,
  withTimeStamp,
  avatarInset = false,
}: PostMediaProps) {
  if (attachments.length === 0) return null;

  const media = [...attachments].sort((a, b) => a.sortIndex - b.sortIndex).map(postMediaItem);

  return (
    <div
      className={
        media.length === 1
          ? 'my-2 w-full max-w-[500px]'
          : avatarInset
            ? 'post-media-bleed post-media-bleed--avatar my-2'
            : 'post-media-bleed my-2'
      }
    >
      <PhotoProvider>
        {media.length === 1 ? (
          <SingleMedia media={media[0]} withTimeStamp={withTimeStamp} />
        ) : (
          <MediaRail media={media} withTimeStamp={withTimeStamp} />
        )}
      </PhotoProvider>
    </div>
  );
}
