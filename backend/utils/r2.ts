import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import formidable from "formidable";
import fs from "fs/promises";
import sharp from "sharp";
import { UploadResult } from "../types/main";

const cacheControl = "public, max-age=31536000"; // 1 year cache

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: `${process.env.R2_ACCESS_KEY_ID}`,
    secretAccessKey: `${process.env.R2_SECRET_KEY_ID}`,
  },
});

async function r2uploadhandler(file: formidable.File) {
  const buffer = await fs.readFile(file.filepath);

  // 生成原始文件的 Key
  const originalKey = `uploads/${file.originalFilename}`;

  // 生成 WebP 文件的 Key
  const webpKey = `compressed/${file.newFilename}.webp`;

  // 上传原始文件
  const originalParam = {
    Bucket: `${process.env.R2_BUCKET}`,
    Key: originalKey,
    Body: buffer,
    cacheControl,
    ContentType: file.mimetype || undefined,
  };
  const originalCommand = new PutObjectCommand(originalParam);

  // 使用 sharp 生成 WebP 版本
  const webpBuffer = await sharp(buffer)
    .rotate()
    .webp({ quality: 20 }) // 你可以调整质量参数
    .toBuffer();

  // 上传 WebP 文件
  const webpParam = {
    Bucket: `${process.env.R2_BUCKET}`,
    Key: webpKey,
    Body: webpBuffer,
    ContentType: "image/webp",
    cacheControl,
    Metadata: {
      "original-filename": file.originalFilename || "",
      "upload-date": new Date().toISOString(),
    },
  };

  const webpCommand = new PutObjectCommand(webpParam);

  try {
    // 分别上传两个文件，并记录结果
    const [originalResult, webpResult] = await Promise.allSettled([
      s3.send(originalCommand),
      s3.send(webpCommand),
    ]);

    // 初始化结果对象
    const result: UploadResult = {
      url: null,
      compressUrl: null,
      details: {
        size: file.size,
        mimetype: file.mimetype,
        mtime: file.mtime,
        hash: file.hash,
      },
    };

    // 检查原始文件上传结果
    if (originalResult.status === "fulfilled") {
      result.url = `https://${process.env.R2_URL_PREFIX}/${originalKey}`;
    } else {
      console.log("Error uploading original file:", originalResult.reason);
    }

    // 检查 WebP 文件上传结果
    if (webpResult.status === "fulfilled") {
      result.compressUrl = `https://${process.env.R2_URL_PREFIX}/${webpKey}`;
    } else {
      console.log("Error uploading WebP file:", webpResult.reason);
    }

    // 如果两个文件都上传失败，返回 null
    if (Object.keys(result).length === 0) {
      return null;
    }

    // 返回结果，可能包含一个或两个 URL
    return result;
  } catch (err) {
    console.log("Unexpected error during file upload:", err);
    return null;
  }
}

export { r2uploadhandler, s3 };
