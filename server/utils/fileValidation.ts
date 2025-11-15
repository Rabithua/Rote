import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// 允许的图片 MIME 类型
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/svg+xml',
];

// 允许的文件扩展名
export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.avif',
  '.svg',
];

/**
 * 验证文件类型（MIME type 和扩展名）
 * @param file formidable 文件对象
 * @throws Error 如果文件类型无效
 */
export function validateFileType(file: formidable.File): void {
  // 验证 MIME type
  if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`不允许的文件类型: ${file.mimetype || '未知'}`);
  }

  // 验证扩展名（如果提供了文件名）
  // 注意：某些情况下可能没有 originalFilename，此时只验证 MIME type
  if (file.originalFilename && file.originalFilename.includes('.')) {
    const ext = path.extname(file.originalFilename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`不允许的文件扩展名: ${ext}`);
    }
  }
}

/**
 * 验证文件内容（使用 magic bytes 或 sharp）
 * 通过验证文件头或使用 sharp 读取文件来验证文件是否为有效的图片
 * @param file formidable 文件对象
 * @throws Error 如果文件内容无效
 */
export async function validateFileContent(file: formidable.File): Promise<void> {
  const buffer = await fs.readFile(file.filepath);

  // SVG 文件：sharp 不支持，使用简单的结构验证
  if (file.mimetype === 'image/svg+xml') {
    const content = buffer.toString('utf-8');
    if (!content.includes('<svg') && !content.includes('<?xml')) {
      throw new Error('无效的 SVG 文件');
    }
    return;
  }

  // HEIC/HEIF 文件：sharp 默认不支持，使用 magic bytes 验证
  if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
    if (buffer.length < 12) {
      throw new Error('无效的 HEIC/HEIF 文件');
    }
    const magicBytes = buffer.slice(4, 8).toString('ascii');
    if (magicBytes !== 'ftyp') {
      throw new Error('无效的 HEIC/HEIF 文件');
    }
    const brand = buffer.slice(8, 12).toString('ascii');
    if (!brand.includes('heic') && !brand.includes('heif') && !brand.includes('mif1')) {
      throw new Error('无效的 HEIC/HEIF 文件');
    }
    return;
  }

  // 其他格式（JPEG, PNG, GIF, WebP, AVIF）：使用 sharp 验证
  // sharp 会验证文件是否为有效的图片格式
  try {
    await sharp(buffer).metadata();
  } catch (error) {
    throw new Error(
      `文件内容验证失败: ${error instanceof Error ? error.message : '无效的图片文件'}`
    );
  }
}

/**
 * 完整验证文件（类型和内容）
 * @param file formidable 文件对象
 * @throws Error 如果文件验证失败
 */
export async function validateFile(file: formidable.File): Promise<void> {
  // 先验证文件类型（MIME type 和扩展名）
  validateFileType(file);

  // 再验证文件内容（magic bytes）
  await validateFileContent(file);
}

/**
 * 验证内容类型（用于 presign 接口）
 * @param contentType 内容类型字符串
 * @throws Error 如果内容类型无效
 */
export function validateContentType(contentType?: string): void {
  if (!contentType) {
    throw new Error('缺少内容类型');
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`不允许的内容类型: ${contentType}`);
  }
}
