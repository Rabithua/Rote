import { and, eq } from 'drizzle-orm';
import { settings } from '../drizzle/schema';
import { mutateStoredConfigs, type ConfigMutation } from '../settings/configStore';
import {
  initializeAuthenticationKeys,
  initializeNotificationKeys,
  rotateAuthenticationKeys,
  rotateNotificationKeys,
} from '../settings/securityKeys';
import type {
  ConfigData,
  ConfigGroup,
  ConfigUpdateOptions,
  NotificationConfig,
  SecurityConfig,
  SecurityKeyRotationScope,
  SystemConfig,
} from '../types/config';
import db from './drizzle';

// 配置变更监听器类型
type ConfigChangeListener = (group: ConfigGroup, newConfig: any, oldConfig: any) => void;

function normalizeConfigForCompatibility(group: ConfigGroup, config: any) {
  if (group !== 'security' || !config || typeof config !== 'object' || Array.isArray(config)) {
    return config;
  }

  const normalized = { ...config };
  // TODO: 下下次更新移除 requireVerifiedEmailForExplore 旧配置键兼容。
  if (
    normalized.requireVerifiedEmailForExplore === undefined &&
    normalized.requireCertifiedUserForExplore !== undefined
  ) {
    normalized.requireVerifiedEmailForExplore = normalized.requireCertifiedUserForExplore;
  }
  return normalized;
}

// 配置管理类
export class ConfigManager {
  private static instance: ConfigManager;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private listeners: Map<ConfigGroup, Set<ConfigChangeListener>> = new Map();
  private globalConfig: Record<ConfigGroup, any> = {} as Record<ConfigGroup, any>;
  private configInitialized = false;
  private operationQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    // A failed operation must not prevent later, independent configuration updates.
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

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
    await this.serialize(async () => {
      if (this.configInitialized) return;
      this.globalConfig = await this.readAllConfigs();
      this.configInitialized = true;
    });
  }

  /**
   * 强制刷新配置缓存
   */
  public async refreshCache(): Promise<void> {
    await this.serialize(async () => {
      const configs = await this.readAllConfigs();
      this.cache.clear();
      this.cacheExpiry.clear();
      this.globalConfig = configs;
    });
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
    return (normalizeConfigForCompatibility(group, this.globalConfig[group]) as T) || null;
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
    return this.serialize(() => this.readConfig<T>(group));
  }

  private async readConfig<T extends ConfigData>(group: ConfigGroup): Promise<T | null> {
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

      const config = normalizeConfigForCompatibility(group, setting.config) as unknown as T;

      // 更新缓存
      this.cache.set(cacheKey, config);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return config;
    } catch {
      console.error(`获取配置失败 [${group}]`);
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
      await this.mutateConfigs([{ group, options, update: () => config }]);
      return true;
    } catch {
      // Database errors can contain bound parameters, including signing keys.
      console.error(`设置配置失败 [${group}]`);
      return false;
    }
  }

  private async mutateConfigs(mutations: ConfigMutation[]) {
    return this.serialize(async () => {
      const changes = await mutateStoredConfigs(mutations);
      // Publish only committed values, in the same order as database writes.
      for (const { group, config, previous } of changes) {
        this.globalConfig[group] = normalizeConfigForCompatibility(group, config);
        this.clearCache(group);
        this.notifyConfigChange(group, config, previous);
      }
      return changes;
    });
  }

  public async updateConfig<T extends ConfigData>(
    group: ConfigGroup,
    update: (existing: T | null) => T | Promise<T>,
    options?: ConfigUpdateOptions
  ): Promise<T> {
    const [change] = await this.mutateConfigs([
      {
        group,
        options,
        update: (existing) => update(existing as T | null),
      },
    ]);
    return change.config as T;
  }

  /**
   * 获取所有配置分组
   */
  public async getAllConfigs(): Promise<Record<ConfigGroup, any>> {
    return this.serialize(() => this.readAllConfigs());
  }

  private async readAllConfigs(): Promise<Record<ConfigGroup, any>> {
    const settingsList = await db
      .select({ group: settings.group, config: settings.config })
      .from(settings);

    const result: Record<string, any> = {};
    settingsList.forEach((setting) => {
      result[setting.group] = normalizeConfigForCompatibility(
        setting.group as ConfigGroup,
        setting.config
      );
    });

    return result as Record<ConfigGroup, any>;
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
   * 初始化缺失的密钥，不改变现有登录和通知密钥。
   */
  public async initializeSecurityKeys(): Promise<boolean> {
    try {
      await this.mutateConfigs([
        {
          group: 'security',
          options: { isRequired: true, isSystem: false },
          update: (existing) =>
            initializeAuthenticationKeys((existing as Partial<SecurityConfig>) || {}),
        },
        {
          group: 'notification',
          options: { isRequired: false, isSystem: false },
          update: (existing) =>
            initializeNotificationKeys((existing as Partial<NotificationConfig>) || {}),
        },
      ]);
      return true;
    } catch {
      console.error('初始化安全密钥失败');
      return false;
    }
  }

  public async rotateSecurityKeys(scope: SecurityKeyRotationScope): Promise<boolean> {
    try {
      const mutations: ConfigMutation[] = [
        {
          group: 'security',
          options: { isRequired: true },
          update: (existing) =>
            rotateAuthenticationKeys((existing as Partial<SecurityConfig>) || {}),
        },
      ];
      if (scope === 'all')
        mutations.push({
          group: 'notification',
          update: (existing) =>
            rotateNotificationKeys((existing as Partial<NotificationConfig>) || {}),
        });
      await this.mutateConfigs(mutations);
      return true;
    } catch {
      console.error('轮换安全密钥失败');
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

export const initializeSecurityKeys = (): Promise<boolean> =>
  configManager.initializeSecurityKeys();

// Existing setup scripts use this export to initialize missing keys.
export const generateSecurityKeys = initializeSecurityKeys;

export const rotateSecurityKeys = (scope: SecurityKeyRotationScope): Promise<boolean> =>
  configManager.rotateSecurityKeys(scope);

export const updateConfig = <T extends ConfigData>(
  group: ConfigGroup,
  update: (existing: T | null) => T | Promise<T>,
  options?: ConfigUpdateOptions
): Promise<T> => configManager.updateConfig(group, update, options);

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
