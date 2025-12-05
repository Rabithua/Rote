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
 * 验证内容类型（用于 presign 接口）
 * @param contentType 内容类型字符串
 * @throws Error 如果内容类型无效
 */
export function validateContentType(contentType?: string): void {
  if (!contentType) {
    throw new Error('Content type is required');
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`Content type not allowed: ${contentType}`);
  }
}
