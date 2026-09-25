import { useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { MediaItem } from './MediaItem';
import type { PostMediaItem } from './postMediaModel';

type MediaRailProps = {
  media: PostMediaItem[];
  withTimeStamp?: boolean;
};

type Drag = { pointerId: number; x: number; scrollLeft: number; moved: boolean };

export function MediaRail({ media, withTimeStamp }: MediaRailProps) {
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      (event.target instanceof Element && Boolean(event.target.closest('button')))
    ) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
    }
    event.currentTarget.scrollLeft = drag.scrollLeft - distance;
    event.preventDefault();
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const stopDraggedClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <div
      className={`post-media-rail ${dragging ? 'post-media-rail-dragging' : ''}`}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onClickCapture={stopDraggedClick}
    >
      {media.map((item) => (
        <MediaItem key={item.attachment.id} media={item} withTimeStamp={withTimeStamp} />
      ))}
    </div>
  );
}
