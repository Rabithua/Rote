import FileSelector from '@/components/others/uploader';
import type { Attachment } from '@/types/main';
import { getAttachmentMediaKind } from '@/utils/directUpload';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PhotoProvider } from 'react-photo-view';
import AttachmentItem from './AttachmentItem';

interface SortableAttachmentItemProps {
  attachment: File | Attachment;
  index: number;
  isUploading: boolean;
  onDelete: (_index: number) => void;
  uploadProgress?: number;
  id: string;
  disabled?: boolean;
}

// 可排序的附件项组件
function SortableAttachmentItem({
  attachment,
  index,
  isUploading,
  onDelete,
  uploadProgress,
  id,
  disabled,
}: SortableAttachmentItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const mediaKind = getAttachmentMediaKind(attachment);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={mediaKind === 'video' ? 'w-full' : undefined}
      {...attributes}
      {...listeners}
    >
      <AttachmentItem
        attachment={attachment}
        index={index}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onDelete={onDelete}
        disabled={disabled}
      />
    </div>
  );
}

interface AttachmentListProps {
  attachments: (File | Attachment)[];
  uploadingFiles: Set<File>;
  onDelete: (_index: number) => void;
  onReorder: (_attachments: (File | Attachment)[]) => void;
  onFileAdd: (_files: File[]) => void;
  roteId?: string;
  disabled?: boolean;
  accept?: string;
  canAddMore?: boolean;
  uploadProgress?: Map<File, number>;
}

function AttachmentList({
  attachments,
  uploadingFiles,
  onDelete,
  onReorder,
  onFileAdd,
  roteId,
  disabled,
  accept,
  canAddMore = true,
  uploadProgress,
}: AttachmentListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要拖拽 8px 才激活，避免与点击冲突
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 生成唯一的 id 用于拖拽
  const attachmentIds = attachments.map((_, index) => `attachment-${index}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = attachmentIds.indexOf(active.id as string);
      const newIndex = attachmentIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newAttachments = arrayMove(attachments, oldIndex, newIndex);
        onReorder(newAttachments);
      }
    }
  };

  return (
    <PhotoProvider>
      <div className="flex flex-wrap gap-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={attachmentIds} strategy={rectSortingStrategy}>
            {attachments.map((attachment, index) => {
              const isUploading = attachment instanceof File && uploadingFiles.has(attachment);
              const progress =
                attachment instanceof File ? uploadProgress?.get(attachment) : undefined;
              return (
                <SortableAttachmentItem
                  key={`attachment-${index}`}
                  id={`attachment-${index}`}
                  attachment={attachment}
                  index={index}
                  isUploading={isUploading}
                  onDelete={onDelete}
                  disabled={disabled}
                  uploadProgress={progress}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {canAddMore && (
          <FileSelector
            id={roteId || 'rote-editor-file-selector'}
            disabled={disabled}
            callback={onFileAdd}
            accept={accept}
          />
        )}
      </div>
    </PhotoProvider>
  );
}

export default AttachmentList;
