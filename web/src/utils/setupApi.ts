import { get, post, put } from './api';

// 设置相关 API 接口

// 获取系统配置状态
export const getConfigStatus = () => get('/site/config-status');

// 获取站点状态
export const getSiteStatus = () => get('/site/status');

// 获取系统初始化状态（管理员）
export const getSystemStatus = () => get('/admin/status');

// 获取所有配置（管理员）
export const getAllSettings = (group?: string) =>
  get(`/admin/settings${group ? `?group=${group}` : ''}`);

// 更新配置（管理员）
export const updateSettings = (group: string, config: any) =>
  put('/admin/settings', { group, config });

// 测试配置连接（管理员）
export const testConfig = (type: string, config: any) =>
  post('/admin/settings/test', { type, config });

// 重新生成安全密钥（超级管理员）
export const regenerateKeys = () => post('/admin/settings/regenerate-keys');

// 检测当前 URL（管理员）
export const detectUrls = () => get('/admin/settings/detect-urls');

// 更新 URL 配置（管理员）
export const updateUrls = (apiUrl?: string, frontendUrl?: string) =>
  post('/admin/settings/update-urls', { apiUrl, frontendUrl });

// 系统初始化向导
export const setupSystem = (setupData: any) => post('/admin/setup', setupData);

// 刷新配置缓存
export const refreshConfigCache = () => post('/admin/refresh-cache');
