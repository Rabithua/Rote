import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { createWriteStream, mkdirSync } from "fs";
import { dirname, join } from "path";

config();

console.log("R2_ACCOUNT_ID:", process.env.R2_ACCOUNT_ID);
console.log("R2_ACCESS_KEY_ID:", process.env.R2_ACCESS_KEY_ID);
console.log("R2_SECRET_KEY_ID:", process.env.R2_SECRET_KEY_ID);
console.log("R2_BUCKET:", process.env.R2_BUCKET);

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: `${process.env.R2_ACCESS_KEY_ID}`,
    secretAccessKey: `${process.env.R2_SECRET_KEY_ID}`,
  },
});

const bucketName = process.env.R2_BUCKET!;
const folderPrefix = "uploads/"; // 替换为你想下载的文件夹名称
const localDownloadPath = "./"; // 本地保存下载文件的根路径

function ensureDirectoryExistence(filePath: string) {
  const dir = dirname(filePath);
  if (dir !== ".") {
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
        reject(new Error("Response body is undefined"));
        return;
      }
      const writeStream = createWriteStream(filePath);
      if ("pipe" in response.Body) {
        response.Body.pipe(writeStream);
      } else {
        reject(new Error("Response body is not a readable stream"));
        return;
      }
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  } catch (err) {
    console.error(`Error downloading file ${key}:`, err);
  }
}

async function downloadAllFiles(): Promise<void> {
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
      console.error("Error listing objects:", err);
      break;
    }
  } while (continuationToken);

  console.log("All files downloaded successfully!");
}

downloadAllFiles();
