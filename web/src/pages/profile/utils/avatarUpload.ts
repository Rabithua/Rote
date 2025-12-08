import { finalize, presign, uploadToSignedUrl } from '@/utils/directUpload';
import { maybeCompressToWebp } from '@/utils/uploadHelpers';
import type { Area } from 'react-easy-crop';

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

// 上传头像
export async function uploadAvatar(
  croppedImageBlob: Blob,
  options?: { maxWidthOrHeight?: number; initialQuality?: number }
): Promise<string> {
  // 将 Blob 转换为 File
  const croppedFile = new File([croppedImageBlob], 'cropped_image.png', {
    type: 'image/png',
  });

  // 获取预签名 URL
  const signItems = await presign([
    {
      filename: croppedFile.name,
      contentType: croppedFile.type,
      size: croppedFile.size,
    },
  ]);

  const item = signItems[0];
  if (!item) {
    throw new Error('Failed to get presign URL');
  }

  // 压缩图片（用于压缩图）
  const compressedBlob = await maybeCompressToWebp(croppedFile, {
    maxWidthOrHeight: options?.maxWidthOrHeight || 512,
    initialQuality: options?.initialQuality || 0.8,
  });

  // 上传原图（必须成功）
  await uploadToSignedUrl(item.original.putUrl, croppedFile);

  // 上传压缩图（可选，失败不影响原图）
  let compressedKey: string | undefined;
  if (compressedBlob) {
    try {
      await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
      // 只有上传成功才记录 compressedKey
      compressedKey = item.compressed.key;
    } catch (error) {
      // 压缩图上传失败，但不影响原图，只记录警告
      // eslint-disable-next-line no-console
      console.warn(`Compressed avatar upload failed for ${item.uuid}:`, error);
      // 不设置 compressedKey，表示压缩图未成功上传
    }
  }

  // 完成上传
  const finalized = await finalize([
    {
      uuid: item.uuid,
      originalKey: item.original.key,
      compressedKey,
      size: croppedFile.size,
      mimetype: croppedFile.type,
    },
  ]);

  if (finalized && finalized.length > 0) {
    const attachment = finalized[0];
    return attachment.compressUrl || attachment.url;
  } else {
    throw new Error('Failed to finalize upload');
  }
}

// 上传封面
export async function uploadCover(file: File): Promise<string> {
  // 获取预签名 URL
  const signItems = await presign([
    {
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      size: file.size,
    },
  ]);

  const item = signItems[0];
  if (!item) {
    throw new Error('Failed to get presign URL');
  }

  // 压缩图片（用于压缩图）
  const compressedBlob = await maybeCompressToWebp(file, {
    maxWidthOrHeight: 2560,
    initialQuality: 0.8,
  });

  // 上传原图（必须成功）
  await uploadToSignedUrl(item.original.putUrl, file);

  // 上传压缩图（可选，失败不影响原图）
  let compressedKey: string | undefined;
  if (compressedBlob) {
    try {
      await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
      // 只有上传成功才记录 compressedKey
      compressedKey = item.compressed.key;
    } catch (error) {
      // 压缩图上传失败，但不影响原图，只记录警告
      // eslint-disable-next-line no-console
      console.warn(`Compressed cover upload failed for ${item.uuid}:`, error);
      // 不设置 compressedKey，表示压缩图未成功上传
    }
  }

  // 完成上传
  const finalized = await finalize([
    {
      uuid: item.uuid,
      originalKey: item.original.key,
      compressedKey,
      size: file.size,
      mimetype: file.type || 'image/jpeg',
    },
  ]);

  if (finalized && finalized.length > 0) {
    const attachment = finalized[0];
    return attachment.compressUrl || attachment.url;
  } else {
    throw new Error('Failed to finalize upload');
  }
}
