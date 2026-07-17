import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { RequestChecksumCalculation } from '@aws-sdk/middleware-flexible-checksums';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from '../types/config';
import { getGlobalConfig } from './config';

const cacheControl = 'public, max-age=31536000'; // 1 year cache

export type StoredObjectInfo = {
  contentLength: number | null;
  contentType: string | null;
};

type StorageClientConfig = {
  s3: S3Client;
  bucketName: string;
  urlPrefix: string;
};

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

function extractCosRegion(endpoint: string): string | null {
  const match = endpoint.match(/cos\.([a-z0-9-]+)\.myqcloud\.com/i);
  return match ? match[1] : null;
}

function normalizeUrlPrefix(prefix: string | undefined): string {
  return (prefix || '').trim().replace(/\/+$/, '');
}

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
  // COS 新桶默认不支持路径风格访问
  return !extractCosRegion(_endpoint);
}

export function createStorageClient(config: StorageConfig): StorageClientConfig {
  const endpoint = normalizeEndpoint(config.endpoint);
  const bucketName = config.bucket;
  const cosRegion = extractCosRegion(endpoint);
  const resolvedRegion = config.region || cosRegion || 'auto';

  if (cosRegion && config.region && config.region !== cosRegion) {
    throw new Error(
      `Storage region mismatch: endpoint region is "${cosRegion}", but config region is "${config.region}"`
    );
  }

  if (cosRegion && resolvedRegion === 'auto') {
    throw new Error('COS requires an explicit region (e.g., ap-shanghai).');
  }

  if (
    cosRegion &&
    bucketName &&
    endpoint.toLowerCase().includes(`${bucketName.toLowerCase()}.cos.${cosRegion}`)
  ) {
    throw new Error(
      `COS endpoint should not include bucket. Use "https://cos.${cosRegion}.myqcloud.com"`
    );
  }

  if (cosRegion && !bucketName) {
    throw new Error('COS requires a bucket name.');
  }

  const s3 = new S3Client({
    region: resolvedRegion,
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // 智能判断是否使用路径风格，兼容所有 S3 兼容服务
    // 路径风格是 S3 API 的标准格式，所有服务商都支持
    forcePathStyle: shouldUsePathStyle(endpoint),
    // 仅在明确要求时计算校验和，避免与 Garage 等 S3 兼容服务的校验和验证冲突
    // Garage 可能不支持或不正确支持 AWS SDK 自动添加的校验和
    requestChecksumCalculation: RequestChecksumCalculation.WHEN_REQUIRED,
  });

  return {
    s3,
    bucketName,
    urlPrefix: normalizeUrlPrefix(config.urlPrefix),
  };
}

// 动态获取 R2 配置并创建 S3 客户端
function getR2Client(): StorageClientConfig | null {
  const config = getGlobalConfig<StorageConfig>('storage');
  if (
    !config ||
    !config.endpoint ||
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.bucket
  ) {
    return null;
  }

  return createStorageClient(config);
}

async function presignPutUrlWithClient(
  clientConfig: StorageClientConfig,
  key: string,
  contentType?: string,
  expiresIn: number = 3600
): Promise<{ putUrl: string; url: string }> {
  const { s3, bucketName, urlPrefix } = clientConfig;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType || undefined,
    CacheControl: cacheControl,
    // 明确不设置校验和算法，避免 AWS SDK 自动添加校验和参数
    // Garage 等 S3 兼容服务可能不支持或不正确支持 AWS SDK 自动添加的校验和
  } as any);

  const putUrl = await getSignedUrl(s3, command, {
    expiresIn,
    // Bind the declared object media type into the signature so the key
    // extension, presign metadata, and actual upload header cannot diverge.
    signableHeaders: contentType ? new Set(['content-type']) : undefined,
  });

  const url = `${urlPrefix}/${key}`;
  return { putUrl, url };
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

  return presignPutUrlWithClient(r2Config, key, contentType, expiresIn);
}

export async function presignPutUrlForConfig(
  config: StorageConfig,
  key: string,
  contentType?: string,
  expiresIn: number = 3600
): Promise<{ putUrl: string; url: string }> {
  return presignPutUrlWithClient(createStorageClient(config), key, contentType, expiresIn);
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

export async function getObjectInfo(key: string): Promise<StoredObjectInfo | null> {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  try {
    const result = await r2Config.s3.send(
      new HeadObjectCommand({ Bucket: r2Config.bucketName, Key: key })
    );
    return {
      contentLength: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
    };
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  const result = await r2Config.s3.send(
    new GetObjectCommand({ Bucket: r2Config.bucketName, Key: key })
  );
  if (!result.Body) {
    throw new Error(`Storage object has no body: ${key}`);
  }
  return result.Body.transformToByteArray();
}

export async function putObjectBytes(
  key: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const r2Config = getR2Client();
  if (!r2Config) {
    throw new Error(
      'R2 storage is not configured. Please complete the storage configuration first.'
    );
  }

  await r2Config.s3.send(
    new PutObjectCommand({
      Bucket: r2Config.bucketName,
      Key: key,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
}
