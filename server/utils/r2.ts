import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import formidable from 'formidable';
import fs from 'fs/promises';
import sharp from 'sharp';
import { StorageConfig } from '../types/config';
import { UploadResult } from '../types/main';
import { getGlobalConfig } from './config';

const cacheControl = 'public, max-age=31536000'; // 1 year cache

// 动态获取 R2 配置并创建 S3 客户端
function getR2Client(): { s3: S3Client; bucketName: string; urlPrefix: string } | null {
  const config = getGlobalConfig<StorageConfig>('storage');
  if (config && config.endpoint && config.accessKeyId && config.secretAccessKey && config.bucket) {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    return {
      s3,
      bucketName: config.bucket,
      urlPrefix: config.urlPrefix || '',
    };
  }
  return null;
}

async function r2uploadhandler(file: formidable.File) {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  const { s3, bucketName, urlPrefix } = r2Config;

  const buffer = await fs.readFile(file.filepath);

  // 生成唯一且稳定的对象 Key，避免并发下被同名文件覆盖
  // 使用 formidable 生成的 newFilename（UUID），并保留原始扩展名
  const extFromOriginal = file.originalFilename?.includes('.')
    ? `.${file.originalFilename?.split('.').pop()}`
    : '';
  const originalKey = `uploads/${file.newFilename}${extFromOriginal}`;

  // Generate key for WebP file
  const webpKey = `compressed/${file.newFilename}.webp`;

  // Upload original file
  const originalParam = {
    Bucket: bucketName,
    Key: originalKey,
    Body: buffer,
    cacheControl,
    ContentType: file.mimetype || undefined,
  };
  const originalCommand = new PutObjectCommand(originalParam);

  // Generate WebP version using sharp
  const webpBuffer = await sharp(buffer)
    .rotate()
    .webp({ quality: 20 }) // Quality parameter can be adjusted
    .toBuffer();

  // Upload WebP file
  const webpParam = {
    Bucket: bucketName,
    Key: webpKey,
    Body: webpBuffer,
    ContentType: 'image/webp',
    cacheControl,
    Metadata: {
      // Header 必须是 ASCII 安全字符，使用 URI 编码避免中文/特殊字符
      'original-filename': file.originalFilename ? encodeURIComponent(file.originalFilename) : '',
      'upload-date': new Date().toISOString(),
    },
  };

  const webpCommand = new PutObjectCommand(webpParam);

  try {
    // Upload both files and record results
    const [originalResult, webpResult] = await Promise.allSettled([
      s3.send(originalCommand),
      s3.send(webpCommand),
    ]);

    // Initialize result object
    const result: UploadResult = {
      url: null,
      compressUrl: null,
      details: {
        size: file.size,
        mimetype: file.mimetype,
        mtime: file.mtime,
        hash: file.hash,
        // 存储对象 key，便于后续删除/追踪
        key: originalKey,
        compressKey: webpKey,
      },
    };

    // Check original file upload result
    if (originalResult.status === 'fulfilled') {
      result.url = `${urlPrefix}/${originalKey}`;
    } else {
      console.log('Error uploading original file:', originalResult.reason);
    }

    // Check WebP file upload result
    if (webpResult.status === 'fulfilled') {
      result.compressUrl = `${urlPrefix}/${webpKey}`;
    } else {
      console.log('Error uploading WebP file:', webpResult.reason);
    }

    // 若两者均失败，则返回 null
    if (!result.url && !result.compressUrl) return null;

    // Return result, may contain one or both URLs
    return result;
  } catch (err) {
    console.log('Unexpected error during file upload:', err);
    return null;
  }
}

async function r2deletehandler(key: string) {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  const { s3, bucketName } = r2Config;

  const deleteParams = {
    Bucket: bucketName,
    Key: key,
  };
  const deleteCommand = new DeleteObjectCommand(deleteParams);
  try {
    const deleteResult = await s3.send(deleteCommand);
    if (deleteResult.$metadata.httpStatusCode === 204) {
      console.log(`Successfully deleted ${key}`);
      return true;
    } else {
      console.log(`Failed to delete ${key}`);
      return false;
    }
  } catch (err) {
    console.log(`Error deleting ${key}:`, err);
    return false;
  }
}

export { r2deletehandler, r2uploadhandler };

// 生成 PUT 预签名 URL，便于前端直传 R2
export async function presignPutUrl(
  key: string,
  contentType?: string,
  expiresIn: number = 3600
): Promise<{ putUrl: string; url: string }> {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  const { s3, bucketName, urlPrefix } = r2Config;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType || undefined,
    cacheControl,
  } as any);

  const putUrl = await getSignedUrl(s3, command, {
    expiresIn,
  });
  const url = `${urlPrefix}/${key}`;
  return { putUrl, url };
}
