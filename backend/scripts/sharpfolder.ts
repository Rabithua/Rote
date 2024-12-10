/**
 * Compress images in a folder using sharp
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const sourceDir = "./uploads"; // 源图片目录
const targetDir = "./compressed"; // 目标目录

interface Stats {
  success: { [key: string]: number };
  fail: { [key: string]: number };
  unsupported: { [key: string]: number };
}

const stats: Stats = {
  success: {},
  fail: {},
  unsupported: {},
};

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 递归处理目录
async function processDirectory(dir: string): Promise<void> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(dir, entry.name);
    const relativePath = path.relative(sourceDir, dir);
    const targetPath = path.join(targetDir, relativePath);

    if (entry.isDirectory()) {
      // 如果是目录，递归处理
      await processDirectory(sourcePath);
    } else if (entry.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(entry.name)) {
      // 如果是图片文件，进行压缩
      const targetFilePath = path.join(
        targetPath,
        `${path.parse(entry.name).name}.webp`
      );
      const fileExtension = path.extname(entry.name).toLowerCase().slice(1);

      // 确保目标目录存在
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      try {
        await sharp(sourcePath).webp({ quality: 20 }).toFile(targetFilePath);

        console.log(`Compressed: ${sourcePath} -> ${targetFilePath}`);
        stats.success[fileExtension] = (stats.success[fileExtension] || 0) + 1;
      } catch (error: any) {
        if (error.message.includes("unsupported image format")) {
          console.warn(`Unsupported format: ${sourcePath}`);
          stats.unsupported[fileExtension] =
            (stats.unsupported[fileExtension] || 0) + 1;
        } else {
          console.error(`Error compressing ${sourcePath}:`, error);
          stats.fail[fileExtension] = (stats.fail[fileExtension] || 0) + 1;
        }
      }
    }
  }
}

// 开始处理
processDirectory(sourceDir)
  .then(() => {
    console.log("Compression completed. Statistics:");
    console.log("Successful:");
    Object.entries(stats.success).forEach(([format, count]) => {
      console.log(`  ${format}: ${count}`);
    });
    console.log("Failed:");
    Object.entries(stats.fail).forEach(([format, count]) => {
      console.log(`  ${format}: ${count}`);
    });
    console.log("Unsupported:");
    Object.entries(stats.unsupported).forEach(([format, count]) => {
      console.log(`  ${format}: ${count}`);
    });

    const totalSuccess = Object.values(stats.success).reduce(
      (a, b) => a + b,
      0
    );
    const totalFail = Object.values(stats.fail).reduce((a, b) => a + b, 0);
    const totalUnsupported = Object.values(stats.unsupported).reduce(
      (a, b) => a + b,
      0
    );
    console.log(`Total successful: ${totalSuccess}`);
    console.log(`Total failed: ${totalFail}`);
    console.log(`Total unsupported: ${totalUnsupported}`);
  })
  .catch((error) => {
    console.error("An error occurred:", error);
  });
