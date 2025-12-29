import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from '../types/config';
import { getGlobalConfig } from './config';

const cacheControl = 'public, max-age=31536000'; // 1 year cache

/**
 * 判断是否需要使用路径风格访问
 * 路径风格是 S3 API 的标准格式，所有 S3 兼容服务都支持：
 * - AWS S3: 支持路径风格和虚拟主机风格
 * - Cloudflare R2: 支持路径风格和虚拟主机风格
 * - Garage: 主要使用路径风格
 * - MinIO: 主要使用路径风格
 * - 其他 S3 兼容服务: 大多数都支持路径风格
 *
 * 为了最大兼容性，默认使用路径风格
 */
function shouldUsePathStyle(_endpoint: string): boolean {
  // 路径风格是标准格式，所有 S3 兼容服务都支持
  // 虚拟主机风格只是 AWS S3 的优化，但不是必需的
  return true;
}

// 动态获取 R2 配置并创建 S3 客户端
function getR2Client(): { s3: S3Client; bucketName: string; urlPrefix: string } | null {
  const config = getGlobalConfig<StorageConfig>('storage');
  if (config && config.endpoint && config.accessKeyId && config.secretAccessKey && config.bucket) {
    const s3 = new S3Client({
      region: config.region || 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // 智能判断是否使用路径风格，兼容所有 S3 兼容服务
      // 路径风格是 S3 API 的标准格式，所有服务商都支持
      forcePathStyle: shouldUsePathStyle(config.endpoint),
    });
    return {
      s3,
      bucketName: config.bucket,
      urlPrefix: config.urlPrefix || '',
    };
  }
  return null;
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

export { r2deletehandler };

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

// 检查 R2 中的对象是否存在
export async function checkObjectExists(key: string): Promise<boolean> {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  const { s3, bucketName } = r2Config;

  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await s3.send(command);
    return true;
  } catch (error: any) {
    // 404 表示文件不存在
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // 其他错误（如权限问题）也视为不存在，避免误判
    console.warn(`Error checking object existence for ${key}:`, error.message || error);
    return false;
  }
}
