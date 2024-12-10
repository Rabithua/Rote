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

  // Generate key for original file
  const originalKey = `uploads/${file.originalFilename}`;

  // Generate key for WebP file
  const webpKey = `compressed/${file.newFilename}.webp`;

  // Upload original file
  const originalParam = {
    Bucket: `${process.env.R2_BUCKET}`,
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
      },
    };

    // Check original file upload result
    if (originalResult.status === "fulfilled") {
      result.url = `https://${process.env.R2_URL_PREFIX}/${originalKey}`;
    } else {
      console.log("Error uploading original file:", originalResult.reason);
    }

    // Check WebP file upload result
    if (webpResult.status === "fulfilled") {
      result.compressUrl = `https://${process.env.R2_URL_PREFIX}/${webpKey}`;
    } else {
      console.log("Error uploading WebP file:", webpResult.reason);
    }

    // Return null if both uploads failed
    if (Object.keys(result).length === 0) {
      return null;
    }

    // Return result, may contain one or both URLs
    return result;
  } catch (err) {
    console.log("Unexpected error during file upload:", err);
    return null;
  }
}

export { r2uploadhandler, s3 };
