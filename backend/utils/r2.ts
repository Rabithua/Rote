import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: `${process.env.R2_ACCESS_KEY_ID}`,
    secretAccessKey: `${process.env.R2_SECRET_KEY_ID}`,
  },
});

async function r2uploadhandler(file: any) {
  console.log(file);
  const { originalname } = file;
  const date = new Date(); // 获取当前日期
  const year = date.getFullYear(); // 获取当前年份
  const month = date.getMonth() + 1; // 获取当前月份（注意月份从 0 开始，需要加 1）
  const Key = `uploads/${year}/${month}/${randomUUID()}_${originalname}`;
  const param = {
    Bucket: `${process.env.R2_BUCKET}`,
    Key,
    Body: `${file.buffer}`,
  };
  const command = new PutObjectCommand(param);
  try {
    const response = await s3.send(command);
    const url = `https://${process.env.R2_URL_PREFIX}/${Key}`;
    return url;
  } catch (err) {
    console.log("Error getting object URL:", err);
    return null;
  }
}

export { r2uploadhandler, s3 };
