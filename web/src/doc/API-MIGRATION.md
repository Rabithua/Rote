# 前端 API 调用迁移指南

## 背景

随着后端 API 已经重构为 RESTful 风格的 v2 版本，我们决定简化前端 API 调用模式。原有的 `/src/api` 目录下的抽象函数已被移除，改为直接在业务逻辑中使用标准化的 API 调用。

## 新的 API 调用方式

我们提供了一个简洁的工具函数集，位于 `/src/utils/api.ts`，包含以下几个核心方法：

```typescript
// 导入API方法
import { get, post, put, del } from '../utils/api';

// 使用示例
const data = await get('/users/me/profile');
const result = await post('/notes', { content: 'New note' });
```

## 旧式调用对照新式调用

### 认证相关

| 旧方法                     | 新方法                         |
| -------------------------- | ------------------------------ |
| `loginByPassword(data)`    | `post('/auth/login', data)`    |
| `registerBypassword(data)` | `post('/auth/register', data)` |
| `logOut()`                 | `post('/auth/logout')`         |
| `apiChangePassword(data)`  | `put('/auth/password', data)`  |

### 用户相关

| 旧方法                               | 新方法                                                         |
| ------------------------------------ | -------------------------------------------------------------- |
| `apiGetUserInfoByUsername(username)` | `get('/users/' + username)`                                    |
| `getMyProfile()`                     | `get('/users/me/profile')`                                     |
| `apiSaveProfile(data)`               | `put('/users/me/profile', data)`                               |
| `apiGetMyTags()`                     | `get('/users/me/tags')`                                        |
| `apiGetMyHeatMap(start, end)`        | `get('/users/me/heatmap', { startDate: start, endDate: end })` |
| `apiGetStatistics()`                 | `get('/users/me/statistics')`                                  |
| `apiExportData()`                    | `get('/users/me/export', null, { responseType: 'blob' })`      |

### 笔记相关

| 旧方法                                   | 新方法                                    |
| ---------------------------------------- | ----------------------------------------- |
| `apiAddRote(data)`                       | `post('/notes', data)`                    |
| `apiGetRote(id)`                         | `get('/notes/' + id)`                     |
| `apiEditRote(data)`                      | `put('/notes/' + data.id, data)`          |
| `apiDeleteRote(id)`                      | `del('/notes/' + id)`                     |
| `apiGetMyRote(params)`                   | `get('/notes', params)`                   |
| `apiGetPublicRote(params)`               | `get('/notes/public', params)`            |
| `apiGetUserPublicRote(username, params)` | `get('/notes/users/' + username, params)` |
| `apiGetRandomRote()`                     | `get('/notes/random')`                    |

### API 密钥相关

| 旧方法                            | 新方法                                    |
| --------------------------------- | ----------------------------------------- |
| `apiGetMyOpenKey()`               | `get('/api-keys')`                        |
| `apiGenerateOpenKey()`            | `post('/api-keys')`                       |
| `apiEditOpenKey(id, permissions)` | `put('/api-keys/' + id, { permissions })` |
| `apiDeleteOpenKey(id)`            | `del('/api-keys/' + id)`                  |

### 订阅相关

| 旧方法                             | 新方法                                              |
| ---------------------------------- | --------------------------------------------------- |
| `apiAddSubscription(data)`         | `post('/subscriptions', data)`                      |
| `apiGetSubscription()`             | `get('/subscriptions')`                             |
| `apiUpdateSubscription(id, data)`  | `put('/subscriptions/' + id, data)`                 |
| `apiDeleteSubscription(id)`        | `del('/subscriptions/' + id)`                       |
| `apiSendNotification(id, message)` | `post('/subscriptions/' + id + '/notify', message)` |

### 附件相关

| 旧方法                      | 新方法（使用预签名接口）                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| `apiUploadFiles(formData)`  | 使用 `presign()`, `uploadToSignedUrl()`, `finalize()` 从 `@/utils/directUpload` |
| `apiDeleteAttachment(id)`   | `del('/attachments/' + id)`                                                     |
| `apiDeleteAttachments(ids)` | `del('/attachments', { data: { ids } })`                                        |
| 无旧方法                    | `put('/attachments/sort', { roteId, attachmentIds })`                           |

**附件上传新方法示例**：

```typescript
import { presign, uploadToSignedUrl, finalize } from '@/utils/directUpload';
import { maybeCompressToWebp } from '@/utils/uploadHelpers';

// 1. 获取预签名 URL
const signItems = await presign([
  {
    filename: file.name,
    contentType: file.type,
    size: file.size,
  },
]);

const item = signItems[0];

// 2. 压缩图片（可选）
const compressedBlob = await maybeCompressToWebp(file, {
  maxWidthOrHeight: 2560,
  initialQuality: 0.8,
});

// 3. 上传原图和压缩图
await uploadToSignedUrl(item.original.putUrl, file);
if (compressedBlob) {
  await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
}

// 4. 完成上传
const finalized = await finalize([
  {
    uuid: item.uuid,
    originalKey: item.original.key,
    compressedKey: compressedBlob ? item.compressed.key : undefined,
    size: file.size,
    mimetype: file.type,
  },
]);
```

## 迁移步骤

1. 在需要API调用的组件中引入新的API工具：

   ```typescript
   import { get, post, put, del } from '../utils/api';
   ```

2. 将现有的API调用替换为新的直接调用：

   **旧方式**（已废弃，仅作参考）:

   ```typescript
   // 注意：旧的 /src/api 目录已移除
   // import { apiGetMyRote } from '../api/rote/main';
   // const notes = await apiGetMyRote({ skip: 0, limit: 10 });
   ```

   **新方式**:

   ```typescript
   import { get } from '../utils/api';

   // 使用
   const notes = await get('/notes', { skip: 0, limit: 10 });
   ```

3. 对于复杂或特殊的API调用，可以在业务组件中创建特定的辅助函数。

## 注意事项

1. 新的API工具会自动处理以下内容：
   - 添加基础URL和API版本前缀
   - 处理认证失败的情况
   - 从响应中提取data字段

2. 所有路径无需添加 `/api/v2` 前缀，工具会自动添加

3. 如果需要自定义请求配置，可以传递第三个参数：
   ```typescript
   get('/users/me/profile', null, { timeout: 30000 });
   ```

## 优点

1. **代码更简洁** - 减少了一层抽象
2. **更符合RESTful风格** - 请求方法和路径直观反映业务含义
3. **易于维护** - 当API变化时只需修改路径，无需修改中间层
4. **更好的类型支持** - 可以为每个请求定义精确的返回类型
