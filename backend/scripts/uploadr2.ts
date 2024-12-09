/**
 * Upload files to R2
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { extname, join, relative } from "path";

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
const localUploadPath = "./compressed"; // 本地 compressed 文件夹路径
const bucketPrefix = "compressed/"; // R2 存储桶中的前缀

const imageExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
];

function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

async function uploadFile(filePath: string, key: string): Promise<boolean> {
  try {
    const fileContent = await readFile(filePath);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
    });

    await s3Client.send(command);
    console.log(`Successfully uploaded ${key}`);
    return true;
  } catch (err) {
    console.error(`Error uploading file ${key}:`, err);
    return false;
  }
}

async function processDirectory(
  dirPath: string
): Promise<{ success: number; failure: number; skipped: number }> {
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = relative(localUploadPath, fullPath);

    if (entry.isDirectory()) {
      const subDirResults = await processDirectory(fullPath);
      successCount += subDirResults.success;
      failureCount += subDirResults.failure;
      skippedCount += subDirResults.skipped;
    } else if (isImageFile(entry.name)) {
      const key = bucketPrefix + relativePath;
      const success = await uploadFile(fullPath, key);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    } else {
      console.log(`Skipping non-image file: ${relativePath}`);
      skippedCount++;
    }
  }

  return {
    success: successCount,
    failure: failureCount,
    skipped: skippedCount,
  };
}

async function uploadAllFiles(): Promise<void> {
  try {
    const results = await processDirectory(localUploadPath);

    console.log("\nUpload Results:");
    console.log(
      `Total files processed: ${
        results.success + results.failure + results.skipped
      }`
    );
    console.log(`Successfully uploaded: ${results.success}`);
    console.log(`Failed to upload: ${results.failure}`);
    console.log(`Skipped (non-image files): ${results.skipped}`);

    if (results.failure > 0) {
      console.log(
        "\nPlease check the error messages above for details on failed uploads."
      );
    }
  } catch (err) {
    console.error("Error processing directory:", err);
  }
}

uploadAllFiles();
