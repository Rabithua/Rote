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
    oscpu: (nav as any).oscpu,
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
 * 获取音频指纹
 */
function getAudioFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);

      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = function (bins) {
        const buffer = bins.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += Math.abs(buffer[i]);
        }
        const audioHash = sum.toString();

        oscillator.disconnect();
        scriptProcessor.disconnect();
        audioContext.close();

        resolve(audioHash);
      };

      oscillator.start(0);
    } catch {
      resolve('audio_not_supported');
    }
  });
}

/**
 * 生成设备指纹哈希
 */
async function generateFingerprint(): Promise<string> {
  const deviceInfo = getDeviceInfo();
  const screenInfo = getScreenInfo();
  const timezoneInfo = getTimezoneInfo();
  const canvasInfo = getCanvasFingerprint();
  const fontList = getFontList();
  const audioHash = await getAudioFingerprint();

  // 组合所有信息
  const fingerprintData = {
    device: deviceInfo,
    screen: screenInfo,
    timezone: timezoneInfo,
    canvas: canvasInfo,
    fonts: fontList.sort().join(','),
    audio: audioHash,
  };

  // 生成哈希值
  const dataString = JSON.stringify(fingerprintData);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataString));
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * 生成临时访客 ID（基于设备指纹 + 随机数）
 */
export async function generateVisitorId(): Promise<string> {
  try {
    // 尝试从 localStorage 获取已存在的访客 ID
    const existingId = localStorage.getItem('rote_visitor_id');
    if (existingId) {
      return existingId;
    }

    // 生成新的访客 ID
    const fingerprint = await generateFingerprint();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);

    const visitorId = `${fingerprint.substring(0, 16)}_${timestamp}_${random}`;

    // 保存到 localStorage
    localStorage.setItem('rote_visitor_id', visitorId);

    return visitorId;
  } catch {
    const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('rote_visitor_id', fallbackId);
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
