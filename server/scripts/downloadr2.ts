/**
 * Download files from R2
 */

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname, join } from 'path';

// 从数据库获取配置
async function getStorageConfig() {
  const prisma = new PrismaClient();
  try {
    const setting = await prisma.setting.findUnique({
      where: { group: 'storage' },
    });

    if (!setting) {
      throw new Error('Storage configuration not found. Please run the initialization first.');
    }

    return setting.config as any;
  } finally {
    await prisma.$disconnect();
  }
}

// 初始化配置
let s3Client: S3Client;
let bucketName: string;

async function initializeConfig() {
  const config = await getStorageConfig();

  console.log('Storage Config:');
  console.log('Endpoint:', config.endpoint);
  console.log('Access Key ID:', config.accessKeyId ? '***' : 'Not set');
  console.log('Secret Access Key:', config.secretAccessKey ? '***' : 'Not set');
  console.log('Bucket:', config.bucket);

  s3Client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  bucketName = config.bucket;
}
const folderPrefix = 'uploads/'; // 替换为你想下载的文件夹名称
const localDownloadPath = './'; // 本地保存下载文件的根路径

function ensureDirectoryExistence(filePath: string) {
  const dir = dirname(filePath);
  if (dir !== '.') {
    mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(key: string): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    const response = await s3Client.send(command);
    const filePath = join(localDownloadPath, key);
    ensureDirectoryExistence(filePath);

    return new Promise<void>((resolve, reject) => {
      if (!response.Body) {
        reject(new Error('Response body is undefined'));
        return;
      }
      const writeStream = createWriteStream(filePath);
      if ('pipe' in response.Body) {
        response.Body.pipe(writeStream);
      } else {
        reject(new Error('Response body is not a readable stream'));
        return;
      }
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  } catch (err) {
    console.error(`Error downloading file ${key}:`, err);
  }
}

async function downloadAllFiles(): Promise<void> {
  try {
    // 初始化配置
    await initializeConfig();

    let continuationToken: string | undefined = undefined;

    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folderPrefix,
        ContinuationToken: continuationToken,
      });

      try {
        const response = await s3Client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key && object.Key !== folderPrefix) {
              // 跳过文件夹本身
              console.log(`Downloading: ${object.Key}`);
              await downloadFile(object.Key);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } catch (err) {
        console.error('Error listing objects:', err);
        break;
      }
    } while (continuationToken);

    console.log('All files downloaded successfully!');
  } catch (err) {
    console.error('Error initializing configuration:', err);
  }
}

downloadAllFiles();
