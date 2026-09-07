import type { Attachment } from '@/types/main';
import { del } from '@/utils/api';
import {
  finalize,
  cancelUploadReservation,
  finalizeReservedUpload,
  presign,
  presignBrowserUpload,
  uploadToSignedUrl,
} from '@/utils/directUpload';
import { maybeCompressToWebp } from '@/utils/uploadHelpers';
import type { Area } from 'react-easy-crop';

export function profileAttachmentUrl(attachment: Attachment): string {
  return attachment.compressUrl || attachment.url;
}

// 生成裁剪后的图片
export async function createCroppedImage(imageSrc: File | Blob, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = URL.createObjectURL(imageSrc);

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // 设置画布尺寸为裁剪区域的尺寸
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      // 在画布上绘制裁剪后的图像
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      // 将画布转换为Blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      }, 'image/png');
    };

    image.onerror = () => {
      reject(new Error('Could not load image'));
    };
  });
}

type ProfileImageUploadOptions = {
  browserDirectUpload?: boolean;
  initialQuality: number;
  maxWidthOrHeight: number;
};

async function uploadProfileImage(
  file: File,
  options: ProfileImageUploadOptions
): Promise<Attachment> {
  const contentType = file.type || 'image/jpeg';
  const compressedBlob = await maybeCompressToWebp(file, {
    maxWidthOrHeight: options.maxWidthOrHeight,
    initialQuality: options.initialQuality,
  });
  const presignFiles = [
    {
      filename: file.name,
      contentType,
      size: file.size,
      ...(compressedBlob && options.browserDirectUpload
        ? {
            compressed: {
              contentType: compressedBlob.type as 'image/jpeg' | 'image/webp',
              size: compressedBlob.size,
            },
          }
        : {}),
    },
  ];
  const directPresign = options.browserDirectUpload
    ? await presignBrowserUpload(presignFiles)
    : null;
  const item = directPresign ? directPresign.items[0] : (await presign(presignFiles))[0];
  if (!item) throw new Error('Failed to get presign URL');

  try {
    await uploadToSignedUrl(item.original.putUrl, file);

    let compressedKey: string | undefined;
    if (compressedBlob && item.compressed) {
      if (directPresign) {
        await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
        compressedKey = item.compressed.key;
      } else {
        try {
          await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
          compressedKey = item.compressed.key;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn(`Compressed profile image upload failed for ${item.uuid}:`, error);
        }
      }
    }

    const finalizePayload = [
      {
        uuid: item.uuid,
        originalKey: item.original.key,
        compressedKey,
        size: file.size,
        mimetype: contentType,
      },
    ];
    const finalized = directPresign
      ? await finalizeReservedUpload(finalizePayload, directPresign.reservationId)
      : await finalize(finalizePayload);

    if (!finalized?.length) throw new Error('Failed to finalize upload');
    return finalized[0] as Attachment;
  } catch (error) {
    if (directPresign) {
      try {
        await cancelUploadReservation(directPresign.reservationId);
      } catch (cancellationError) {
        // eslint-disable-next-line no-console
        console.error('Failed to cancel profile image upload reservation:', cancellationError);
      }
    }
    throw error;
  }
}

// 上传头像
export async function uploadAvatar(
  croppedImageBlob: Blob,
  options?: {
    browserDirectUpload?: boolean;
    maxWidthOrHeight?: number;
    initialQuality?: number;
  }
): Promise<Attachment> {
  const croppedFile = new File([croppedImageBlob], 'cropped_image.png', {
    type: 'image/png',
  });
  return uploadProfileImage(croppedFile, {
    browserDirectUpload: options?.browserDirectUpload,
    maxWidthOrHeight: options?.maxWidthOrHeight || 512,
    initialQuality: options?.initialQuality || 0.8,
  });
}

// 上传封面
export async function uploadCover(
  file: File,
  options?: { browserDirectUpload?: boolean }
): Promise<Attachment> {
  return uploadProfileImage(file, {
    browserDirectUpload: options?.browserDirectUpload,
    maxWidthOrHeight: 2560,
    initialQuality: 0.8,
  });
}

export async function deletePendingProfileAttachment(attachmentId: string): Promise<void> {
  await del(`/attachments/${attachmentId}`);
}
