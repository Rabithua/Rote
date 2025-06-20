# 反应系统 API 详细文档

## 概述

反应系统允许用户（包括已登录用户和匿名访客）对笔记添加emoji表情反应。系统支持多种反应类型，同一用户可以对同一笔记添加多种不同的反应。

## 特性

- ✅ **多用户类型支持**: 已登录用户和匿名访客
- ✅ **任意emoji反应**: 支持任何Unicode emoji字符
- ✅ **多重反应**: 同一用户可添加多种不同反应
- ✅ **设备指纹识别**: 使用设备指纹技术识别匿名访客
- ✅ **实时更新**: 反应数据实时更新到笔记详情
- ✅ **数据统计**: 自动统计反应数量和类型

## API 接口

### 1. 添加反应

**接口**: `POST /api/v2/reactions`

**请求体**:

```typescript
interface AddReactionRequest {
  type: string; // emoji反应类型（如：👍、❤️、😊）
  roteid: string; // 笔记ID（24位MongoDB ObjectId）
  visitorId?: string; // 访客设备指纹ID（匿名用户必需）
  visitorInfo?: {
    // 访客信息（可选）
    browser?: string;
    os?: string;
    device?: string;
    [key: string]: any;
  };
  metadata?: {
    // 附加元数据（可选）
    source?: string; // 来源标识（如：web、mobile）
    [key: string]: any;
  };
}
```

**响应示例**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "type": "👍",
    "roteid": "507f1f77bcf86cd799439011",
    "userid": "60f1a2b3c4d5e6f7g8h9i0j1",
    "visitorId": null,
    "createdAt": "2025-06-08T10:30:00.000Z",
    "isActive": true
  }
}
```

### 2. 删除反应

**接口**: `DELETE /api/v2/reactions/:roteid/:type`

**路径参数**:

- `roteid`: 笔记ID
- `type`: 反应类型（emoji字符）

**查询参数**:

- `visitorId`: 访客设备指纹ID（匿名用户必需）

**响应示例**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "count": 1
  }
}
```

## 使用示例

### 已登录用户添加反应

```bash
curl -X POST '/api/v2/reactions' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: connect.sid=...' \
  -d '{
    "type": "👍",
    "roteid": "507f1f77bcf86cd799439011",
    "metadata": {
      "source": "web"
    }
  }'
```

### 匿名访客添加反应

```bash
curl -X POST '/api/v2/reactions' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "❤️",
    "roteid": "507f1f77bcf86cd799439011",
    "visitorId": "fp_1234567890abcdef",
    "visitorInfo": {
      "browser": "Chrome",
      "os": "macOS",
      "device": "desktop"
    },
    "metadata": {
      "source": "web"
    }
  }'
```

### 删除反应

```bash
# 已登录用户
curl -X DELETE '/api/v2/reactions/507f1f77bcf86cd799439011/👍' \
  -H 'Cookie: connect.sid=...'

# 匿名访客
curl -X DELETE '/api/v2/reactions/507f1f77bcf86cd799439011/❤️?visitorId=fp_1234567890abcdef'
```

## 数据模型

### Reaction 模型

```typescript
interface Reaction {
  id: string; // 反应唯一标识
  type: string; // 反应类型（emoji）
  roteid: string; // 笔记ID
  userid?: string; // 用户ID（已登录用户）
  visitorId?: string; // 访客设备指纹ID（匿名用户）
  visitorInfo?: object; // 访客信息
  metadata?: object; // 附加元数据
  isActive: boolean; // 是否活跃（软删除）
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}
```

### 笔记中的反应数据

当获取笔记详情时，会自动包含反应数据：

```typescript
interface RoteWithReactions {
  id: string;
  title: string;
  content: string;
  // ... 其他笔记字段
  reactions: Reaction[]; // 所有活跃的反应
}
```

## 设备指纹

### 生成设备指纹

前端需要生成唯一的设备指纹来标识匿名访客：

```typescript
// 示例设备指纹生成（前端）
function generateDeviceFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Device fingerprint', 2, 2);

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ].join('|');

  return 'fp_' + btoa(fingerprint).slice(0, 16);
}
```

## 业务逻辑

### 反应去重

- 同一用户（已登录或匿名）对同一笔记的同一反应类型只能存在一个
- 添加已存在的反应会返回现有反应
- 支持同一用户添加多种不同类型的反应

### 权限控制

- 公开笔记：任何人都可以添加反应
- 私有笔记：只有笔记作者可以添加反应
- 删除反应：只能删除自己添加的反应

### 数据统计

反应数据会自动聚合，可以通过笔记详情接口获取：

```json
{
  "reactions": [
    {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "type": "👍",
      "roteid": "507f1f77bcf86cd799439011",
      "userid": "60f1a2b3c4d5e6f7g8h9i0j1",
      "createdAt": "2025-06-08T10:30:00.000Z"
    },
    {
      "id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "type": "❤️",
      "roteid": "507f1f77bcf86cd799439011",
      "visitorId": "fp_1234567890abcdef",
      "createdAt": "2025-06-08T10:31:00.000Z"
    }
  ]
}
```

## 错误处理

### 常见错误

| 错误码 | 描述                  | 解决方案                 |
| ------ | --------------------- | ------------------------ |
| 400    | 缺少必需参数          | 检查请求参数             |
| 400    | 无效的笔记ID格式      | 确保roteid为24位ObjectId |
| 404    | 笔记不存在            | 检查笔记ID是否正确       |
| 400    | 匿名用户缺少visitorId | 提供设备指纹ID           |

### 错误响应示例

```json
{
  "code": 400,
  "message": "Type and rote ID are required",
  "data": null
}
```

## 性能考虑

### 索引优化

```sql
-- 反应查询优化索引
CREATE INDEX idx_reaction_rote_user ON reactions(roteid, userid);
CREATE INDEX idx_reaction_rote_visitor ON reactions(roteid, visitorId);
CREATE INDEX idx_reaction_active ON reactions(isActive);
```

### 缓存策略

- 笔记反应数据可以缓存5分钟
- 反应统计数据可以缓存1小时
- 使用Redis缓存热门笔记的反应数据

## 安全考虑

### 防止滥用

- 实施速率限制：每个用户/访客每分钟最多10个反应操作
- 设备指纹验证：防止恶意生成假指纹
- 反垃圾邮件：监控异常反应模式

### 数据隐私

- 访客信息仅用于统计，不存储敏感数据
- 设备指纹不可逆向工程
- 遵循GDPR等隐私法规

---

_文档版本: v1.0.0_  
_最后更新: 2025-06-08_
