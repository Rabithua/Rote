import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from '../types/config';
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
