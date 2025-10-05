import crypto from 'crypto';
import webpush from 'web-push';

/**
 * 密钥生成工具类
 */
export class KeyGenerator {
  /**
   * 生成 JWT 密钥
   * @param length 密钥长度，默认 64 字节
   * @returns base64 编码的密钥
   */
  public static generateJWTSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * 生成 Session 密钥
   * @param length 密钥长度，默认 32 字节
   * @returns base64 编码的密钥
   */
  public static generateSessionSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * 生成 VAPID 密钥对
   * @returns VAPID 密钥对
   */
  public static generateVAPIDKeys(): { publicKey: string; privateKey: string } {
    const vapidKeys = webpush.generateVAPIDKeys();
    return {
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
    };
  }

  /**
   * 生成随机字符串
   * @param length 长度，默认 32
   * @param encoding 编码格式，默认 'hex'
   * @returns 随机字符串
   */
  public static generateRandomString(
    length: number = 32,
    encoding: BufferEncoding = 'hex'
  ): string {
    return crypto.randomBytes(length).toString(encoding);
  }

  /**
   * 生成 API 密钥
   * @param prefix 前缀，默认 'rk_'
   * @returns API 密钥
   */
  public static generateApiKey(prefix: string = 'rk_'): string {
    const randomPart = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomPart}`;
  }

  /**
   * 生成密码盐值
   * @param length 长度，默认 16 字节
   * @returns 盐值
   */
  public static generateSalt(length: number = 16): Buffer {
    return crypto.randomBytes(length);
  }
}
