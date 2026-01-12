/**
 * 设备指纹生成工具
 * 用于识别未登录访客的设备和浏览器特征
 */

interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  vendor: string;
  vendorSub: string;
  productSub: string;
  oscpu?: string;
}

interface ScreenInfo {
  width: number;
  height: number;
  colorDepth: number;
  pixelDepth: number;
  availWidth: number;
  availHeight: number;
  devicePixelRatio: number;
}

interface TimezoneInfo {
  timezone: string;
  timezoneOffset: number;
}

interface CanvasFingerprint {
  canvas2d: string;
  webgl: string;
}

/**
 * 获取设备基本信息
 */
function getDeviceInfo(): DeviceInfo {
  const nav = navigator;
  return {
    userAgent: nav.userAgent,
    language: nav.language,
    platform: nav.platform,
    cookieEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack,
    hardwareConcurrency: nav.hardwareConcurrency || 0,
    maxTouchPoints: nav.maxTouchPoints || 0,
    vendor: nav.vendor,
    vendorSub: nav.vendorSub,
    productSub: nav.productSub,
    oscpu: (nav as { oscpu?: string }).oscpu,
  };
}

/**
 * 获取屏幕信息
 */
function getScreenInfo(): ScreenInfo {
  const screen = window.screen;
  return {
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * 获取时区信息
 */
function getTimezoneInfo(): TimezoneInfo {
  const date = new Date();
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: date.getTimezoneOffset(),
  };
}

/**
 * 生成 Canvas 指纹
 */
function getCanvasFingerprint(): CanvasFingerprint {
  // 2D Canvas 指纹
  const canvas2d = document.createElement('canvas');
  const ctx2d = canvas2d.getContext('2d');
  let canvas2dHash = '';

  if (ctx2d) {
    canvas2d.width = 200;
    canvas2d.height = 50;

    // 绘制文本和图形
    ctx2d.textBaseline = 'top';
    ctx2d.font = '14px Arial';
    ctx2d.fillStyle = '#f60';
    ctx2d.fillRect(125, 1, 62, 20);
    ctx2d.fillStyle = '#069';
    ctx2d.fillText('Device Fingerprint 🔍', 2, 15);
    ctx2d.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx2d.fillText('Device Fingerprint 🔍', 4, 17);

    canvas2dHash = canvas2d.toDataURL();
  }

  // WebGL 指纹
  let webglHash = '';
  try {
    const canvas3d = document.createElement('canvas');
    const gl =
      (canvas3d.getContext('webgl') as WebGLRenderingContext) ||
      (canvas3d.getContext('experimental-webgl') as WebGLRenderingContext);

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        webglHash = `${vendor}~${renderer}`;
      }
    }
  } catch {
    // WebGL 不支持或被禁用
  }

  return {
    canvas2d: canvas2dHash,
    webgl: webglHash,
  };
}

/**
 * 获取字体信息
 */
function getFontList(): string[] {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial',
    'Arial Black',
    'Calibri',
    'Cambria',
    'Comic Sans MS',
    'Consolas',
    'Courier',
    'Courier New',
    'Georgia',
    'Helvetica',
    'Impact',
    'Lucida Console',
    'Lucida Sans Unicode',
    'Microsoft Sans Serif',
    'Palatino Linotype',
    'Tahoma',
    'Times',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    'Wingdings',
  ];

  const availableFonts: string[] = [];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) return availableFonts;

  // 获取基础字体的宽度
  const baseSizes: { [key: string]: number } = {};
  for (const baseFont of baseFonts) {
    context.font = `${testSize} ${baseFont}`;
    baseSizes[baseFont] = context.measureText(testString).width;
  }

  // 测试每个字体
  for (const testFont of testFonts) {
    let detected = false;
    for (const baseFont of baseFonts) {
      context.font = `${testSize} ${testFont}, ${baseFont}`;
      const width = context.measureText(testString).width;
      if (width !== baseSizes[baseFont]) {
        detected = true;
        break;
      }
    }
    if (detected) {
      availableFonts.push(testFont);
    }
  }

  return availableFonts;
}

/**
 * 简单的字符串哈希函数（作为 crypto.subtle 的降级方案）
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 将数字转换为16进制字符串，并补齐到64位
  const hexHash = Math.abs(hash).toString(16);
  return hexHash.padStart(16, '0').repeat(4).substring(0, 64);
}

/**
 * 生成设备指纹哈希
 * 只使用稳定的设备特征，确保同一设备生成相同的指纹
 */
async function generateFingerprint(): Promise<string> {
  const deviceInfo = getDeviceInfo();
  const screenInfo = getScreenInfo();
  const timezoneInfo = getTimezoneInfo();
  const canvasInfo = getCanvasFingerprint();
  const fontList = getFontList();
  // 移除音频指纹，因为它不够稳定
  // const audioHash = await getAudioFingerprint();

  // 只使用稳定的设备特征
  const fingerprintData = {
    // 设备稳定特征
    userAgent: deviceInfo.userAgent,
    platform: deviceInfo.platform,
    language: deviceInfo.language,
    hardwareConcurrency: deviceInfo.hardwareConcurrency,
    maxTouchPoints: deviceInfo.maxTouchPoints,
    vendor: deviceInfo.vendor,
    // 屏幕稳定特征
    screenWidth: screenInfo.width,
    screenHeight: screenInfo.height,
    colorDepth: screenInfo.colorDepth,
    devicePixelRatio: screenInfo.devicePixelRatio,
    // 时区
    timezone: timezoneInfo.timezone,
    // Canvas 指纹（相对稳定）
    canvas: canvasInfo,
    // 字体列表
    fonts: fontList.sort().join(','),
  };

  // 生成哈希值
  const dataString = JSON.stringify(fingerprintData);

  // 检查 crypto.subtle 是否可用（仅在安全上下文中可用：HTTPS 或 localhost）
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataString));
      const hashArray = Array.from(new Uint8Array(hash));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch {
      // crypto.subtle 调用失败，使用降级方案
      return simpleHash(dataString);
    }
  }

  // crypto.subtle 不可用（非安全上下文），使用简单哈希
  return simpleHash(dataString);
}

/**
 * 生成访客 ID（基于纯设备指纹）
 * 同一设备即使清除 localStorage 后也会生成相同的 ID
 */
export async function generateVisitorId(): Promise<string> {
  try {
    // 直接生成设备指纹作为访客 ID
    // 不依赖 localStorage 缓存，确保同一设备始终返回相同 ID
    const fingerprint = await generateFingerprint();

    // 使用完整指纹的前32位作为访客 ID，加上 'fp_' 前缀标识
    const visitorId = `fp_${fingerprint.substring(0, 32)}`;

    // 可选：缓存到 localStorage 以提高性能（但不依赖它）
    try {
      localStorage.setItem('rote_visitor_id', visitorId);
    } catch {
      // localStorage 不可用，忽略
    }

    return visitorId;
  } catch (error) {
    console.warn('生成访客 ID 失败，使用降级方案:', error);
    // 降级方案：使用基本设备信息生成简单哈希
    const fallbackData = `${navigator.userAgent}_${navigator.language}_${screen.width}x${screen.height}`;
    const fallbackId = `fb_${simpleHash(fallbackData).substring(0, 32)}`;
    return fallbackId;
  }
}

/**
 * 获取访客信息（用于存储在 visitorInfo 字段）
 */
export function getVisitorInfo() {
  const deviceInfo = getDeviceInfo();
  const screenInfo = getScreenInfo();
  const timezoneInfo = getTimezoneInfo();

  return {
    userAgent: deviceInfo.userAgent,
    language: deviceInfo.language,
    platform: deviceInfo.platform,
    screen: `${screenInfo.width}x${screenInfo.height}`,
    timezone: timezoneInfo.timezone,
    timestamp: new Date().toISOString(),
    // 获取 IP 地址需要通过后端获取
  };
}

/**
 * 清除访客 ID（用于重置）
 */
export function clearVisitorId(): void {
  localStorage.removeItem('rote_visitor_id');
}

export default {
  generateVisitorId,
  getVisitorInfo,
  clearVisitorId,
};
