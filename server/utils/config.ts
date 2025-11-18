import { and, eq } from 'drizzle-orm';
import { settings } from '../drizzle/schema';
import type { ConfigData, ConfigGroup, ConfigUpdateOptions, SystemConfig } from '../types/config';
import db from './drizzle';
import { KeyGenerator } from './keyGenerator';

// 配置变更监听器类型
type ConfigChangeListener = (group: ConfigGroup, newConfig: any, oldConfig: any) => void;

// 配置管理类
export class ConfigManager {
  private static instance: ConfigManager;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private listeners: Map<ConfigGroup, Set<ConfigChangeListener>> = new Map();
  private globalConfig: Record<ConfigGroup, any> = {} as Record<ConfigGroup, any>;
  private configInitialized = false;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 初始化配置管理器，预加载所有配置
   */
  public async initialize(): Promise<void> {
    if (this.configInitialized) {
      return;
    }

    try {
      console.log('🔄 Initializing configuration manager...');

      // 预加载所有配置
      this.globalConfig = await this.getAllConfigs();
      this.configInitialized = true;

      console.log('✅ Configuration manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize configuration manager:', error);
      throw error;
    }
  }

  /**
   * 强制刷新配置缓存
   */
  public async refreshCache(): Promise<void> {
    try {
      console.log('🔄 Refreshing configuration cache...');

      // 清空当前缓存
      this.cache.clear();
      this.cacheExpiry.clear();

      // 重新加载所有配置
      this.globalConfig = await this.getAllConfigs();

      console.log('✅ Configuration cache refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh configuration cache:', error);
      throw error;
    }
  }

  /**
   * 检查配置管理器状态
   */
  public isInitialized(): boolean {
    return this.configInitialized;
  }

  /**
   * 获取配置状态信息
   */
  public getConfigStatus(): { initialized: boolean; configCount: number; configs: string[] } {
    return {
      initialized: this.configInitialized,
      configCount: Object.keys(this.globalConfig).length,
      configs: Object.keys(this.globalConfig),
    };
  }

  /**
   * 验证系统配置是否正确加载
   */
  public validateSystemConfiguration(): void {
    console.log('🔍 Validating system configuration...');

    if (!this.configInitialized) {
      throw new Error('Configuration manager not initialized');
    }

    const configStatus = this.getConfigStatus();
    console.log(`📊 Configuration status: ${configStatus.configCount} configs loaded`);
    console.log(`📋 Available configs: ${configStatus.configs.join(', ')}`);

    // 验证安全配置
    const securityConfig = this.getGlobalConfig('security');
    if (
      !securityConfig ||
      !(securityConfig as any).jwtSecret ||
      !(securityConfig as any).jwtRefreshSecret
    ) {
      console.warn('⚠️  Security configuration not properly loaded');
    } else {
      console.log('✅ Security configuration loaded');
    }

    // 验证站点配置
    const siteConfig = this.getGlobalConfig('site');
    if (!siteConfig || !(siteConfig as any).name) {
      console.warn('⚠️  Site configuration not properly loaded');
    } else {
      console.log('✅ Site configuration loaded');
    }

    // 验证存储配置
    const storageConfig = this.getGlobalConfig('storage');
    if (!storageConfig || !(storageConfig as any).bucket) {
      console.warn('⚠️  Storage configuration not properly loaded');
    } else {
      console.log('✅ Storage configuration loaded');
    }

    console.log('✅ System configuration validation completed');
  }

  /**
   * 获取全局配置（同步，从内存读取）
   */
  public getGlobalConfig<T extends ConfigData>(group: ConfigGroup): T | null {
    return (this.globalConfig[group] as T) || null;
  }

  /**
   * 获取所有全局配置
   */
  public getAllGlobalConfigs(): Record<ConfigGroup, any> {
    return { ...this.globalConfig };
  }

  /**
   * 订阅配置变更
   */
  public subscribe(group: ConfigGroup, listener: ConfigChangeListener): () => void {
    if (!this.listeners.has(group)) {
      this.listeners.set(group, new Set());
    }

    this.listeners.get(group)!.add(listener);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(group)?.delete(listener);
    };
  }

  /**
   * 通知配置变更
   */
  private notifyConfigChange(group: ConfigGroup, newConfig: any, oldConfig: any): void {
    const groupListeners = this.listeners.get(group);
    if (groupListeners) {
      groupListeners.forEach((listener) => {
        try {
          listener(group, newConfig, oldConfig);
        } catch (error) {
          console.error(`Error in config change listener for ${group}:`, error);
        }
      });
    }
  }

  /**
   * 获取指定分组的配置
   */
  public async getConfig<T extends ConfigData>(group: ConfigGroup): Promise<T | null> {
    // 检查缓存
    const cacheKey = `config_${group}`;
    const cached = this.cache.get(cacheKey);
    const expiry = this.cacheExpiry.get(cacheKey);

    if (cached && expiry && Date.now() < expiry) {
      return cached as T;
    }

    try {
      const [setting] = await db
        .select({ config: settings.config })
        .from(settings)
        .where(eq(settings.group, group))
        .limit(1);

      if (!setting) {
        return null;
      }

      const config = setting.config as unknown as T;

      // 更新缓存
      this.cache.set(cacheKey, config);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return config;
    } catch (error) {
      console.error(`获取配置失败 [${group}]:`, error);
      return null;
    }
  }

  /**
   * 设置指定分组的配置
   */
  public async setConfig<T extends ConfigData>(
    group: ConfigGroup,
    config: T,
    options?: ConfigUpdateOptions
  ): Promise<boolean> {
    try {
      // 获取旧配置用于通知
      const oldConfig = this.globalConfig[group];

      // 先尝试查找现有配置
      const [existing] = await db.select().from(settings).where(eq(settings.group, group)).limit(1);

      if (existing) {
        // 更新现有配置
        await db
          .update(settings)
          .set({
            config: config as unknown as any,
            isRequired: options?.isRequired ?? false,
            isSystem: options?.isSystem ?? false,
            isInitialized: options?.isInitialized ?? true,
            updatedAt: new Date(),
          })
          .where(eq(settings.group, group));
      } else {
        // 创建新配置
        // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
        const insertData: any = {
          group,
          config: config as unknown as any,
          isRequired: options?.isRequired ?? false,
          isSystem: options?.isSystem ?? false,
          isInitialized: options?.isInitialized ?? true,
        };
        await db.insert(settings).values(insertData);
      }

      // 更新全局配置
      this.globalConfig[group] = config;

      // 清除缓存
      this.clearCache(group);

      // 通知配置变更
      this.notifyConfigChange(group, config, oldConfig);

      return true;
    } catch (error) {
      console.error(`设置配置失败 [${group}]:`, error);
      return false;
    }
  }

  /**
   * 获取所有配置分组
   */
  public async getAllConfigs(): Promise<Record<ConfigGroup, any>> {
    try {
      const settingsList = await db
        .select({ group: settings.group, config: settings.config })
        .from(settings);

      const result: Record<string, any> = {};
      settingsList.forEach((setting) => {
        result[setting.group] = setting.config;
      });

      return result as Record<ConfigGroup, any>;
    } catch (error) {
      console.error('获取所有配置失败:', error);
      return {} as Record<ConfigGroup, any>;
    }
  }

  /**
   * 检查系统是否已初始化
   */
  public async isSystemInitialized(): Promise<boolean> {
    const systemConfig = await this.getConfig<SystemConfig>('system');
    return systemConfig?.isInitialized ?? false;
  }

  /**
   * 获取必需但未初始化的配置分组
   */
  public async getMissingRequiredConfigs(): Promise<ConfigGroup[]> {
    try {
      const requiredSettings = await db
        .select({ group: settings.group })
        .from(settings)
        .where(and(eq(settings.isRequired, true), eq(settings.isInitialized, false)));

      return requiredSettings.map((s) => s.group as ConfigGroup);
    } catch (error) {
      console.error('获取缺失配置失败:', error);
      return [];
    }
  }

  /**
   * 清除指定分组的缓存
   */
  public clearCache(group?: ConfigGroup): void {
    if (group) {
      this.cache.delete(`config_${group}`);
      this.cacheExpiry.delete(`config_${group}`);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * 自动生成安全密钥
   */
  public async generateSecurityKeys(): Promise<boolean> {
    try {
      // 生成 JWT 密钥
      const jwtSecret = KeyGenerator.generateJWTSecret();
      const jwtRefreshSecret = KeyGenerator.generateJWTSecret();
      const sessionSecret = KeyGenerator.generateSessionSecret();

      // 生成 VAPID 密钥
      const vapidKeys = KeyGenerator.generateVAPIDKeys();

      // 更新安全配置
      await this.setConfig(
        'security',
        {
          jwtSecret,
          jwtRefreshSecret,
          jwtAccessExpiry: '15m',
          jwtRefreshExpiry: '7d',
          sessionSecret,
        },
        { isRequired: true, isSystem: false }
      );

      // 更新通知配置
      await this.setConfig(
        'notification',
        {
          vapidPublicKey: vapidKeys.publicKey,
          vapidPrivateKey: vapidKeys.privateKey,
        },
        { isRequired: false, isSystem: false }
      );

      return true;
    } catch (error) {
      console.error('生成安全密钥失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

// 导出便捷方法
export const getConfig = <T extends ConfigData>(group: ConfigGroup): Promise<T | null> =>
  configManager.getConfig<T>(group);

export const setConfig = <T extends ConfigData>(
  group: ConfigGroup,
  config: T,
  options?: ConfigUpdateOptions
): Promise<boolean> => configManager.setConfig(group, config, options);

export const isInitialized = (): Promise<boolean> => configManager.isSystemInitialized();

export const getMissingRequiredConfigs = (): Promise<ConfigGroup[]> =>
  configManager.getMissingRequiredConfigs();

export const generateSecurityKeys = (): Promise<boolean> => configManager.generateSecurityKeys();

export const getAllConfigs = (): Promise<Record<ConfigGroup, any>> => configManager.getAllConfigs();

// 全局配置管理方法
export const initializeConfig = (): Promise<void> => configManager.initialize();

export const getGlobalConfig = <T extends ConfigData>(group: ConfigGroup): T | null =>
  configManager.getGlobalConfig<T>(group);

export const getAllGlobalConfigs = (): Record<ConfigGroup, any> =>
  configManager.getAllGlobalConfigs();

export const subscribeConfigChange = (
  group: ConfigGroup,
  listener: ConfigChangeListener
): (() => void) => configManager.subscribe(group, listener);

export const refreshConfigCache = (): Promise<void> => configManager.refreshCache();

export const isConfigManagerInitialized = (): boolean => configManager.isInitialized();

export const getConfigManagerStatus = (): {
  initialized: boolean;
  configCount: number;
  configs: string[];
} => configManager.getConfigStatus();

export const validateSystemConfiguration = (): void => configManager.validateSystemConfiguration();
