# 附件接口使用指南

本指南面向对接方，说明如何使用附件相关的接口进行附件的上传、删除、排序等操作。仅包含使用方法与示例，不涉及实现细节。

## 概述

附件系统支持两种上传方式：

1. **传统上传**：通过 multipart/form-data 直接上传到服务器
2. **预签名直传**：前端获取预签名 URL 后直接上传到对象存储（推荐，性能更好）

## 基础信息

- **基础路径**: `/v2/api/attachments`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 在需要鉴权的接口，加请求头 `Authorization: Bearer <accessToken>`
- **存储要求**: 所有附件接口都需要配置对象存储（R2/S3）

## 字段说明

- **id**: 附件 ID（UUID 格式）
- **url**: 附件原始 URL
- **compressUrl**: 压缩后的附件 URL（可选，可能为 `null` 或空字符串，图片会自动生成 WebP 压缩版本）
- **storage**: 存储类型（如 `"R2"`）
- **details**: 附件详细信息（JSON 对象），包含：
  - `key`: 对象存储中的原始文件 Key
  - `compressKey`: 对象存储中的压缩文件 Key（可选）
  - `size`: 文件大小（字节）
  - `mimetype`: MIME 类型（如 `"image/jpeg"`）
  - `mtime`: 修改时间（ISO 8601 格式或 Date 对象，可能为 `null`）
  - `hash`: 文件哈希值（可选，可能为 `null`）
- **sortIndex**: 排序索引（数字，用于控制附件在笔记中的显示顺序）
- **userid**: 用户 ID（UUID 格式）
- **roteid**: 笔记 ID（UUID 格式，可选，未绑定时为 `null`）
- **createdAt**: 创建时间（ISO 8601 格式）
- **updatedAt**: 更新时间（ISO 8601 格式）

---

## 1) 上传附件（传统方式）

通过 multipart/form-data 直接上传文件到服务器。

- **方法**: POST
- **URL**: `/v2/api/attachments/`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: multipart/form-data`
- **查询参数**:
  - `noteId` (可选): 笔记 ID（UUID 格式），如果提供，附件将直接绑定到该笔记
- **Body**:
  - `images`: 文件字段（支持多文件上传）
    - 单次最多上传 9 个文件
    - 单个文件最大 20MB
    - 单次请求总大小最大 100MB
    - 支持图片格式：JPEG、PNG、WebP、GIF、HEIC、HEIF、AVIF、SVG

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/attachments/?noteId=note-uuid' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -F 'images=@/path/to/image1.jpg' \
  -F 'images=@/path/to/image2.png'
```

成功响应示例（201）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "attachment-uuid-1",
      "url": "https://storage.example.com/users/user-uuid/uploads/uuid1.jpg",
      "compressUrl": "https://storage.example.com/users/user-uuid/compressed/uuid1.webp",
      "storage": "R2",
      "details": {
        "key": "users/user-uuid/uploads/uuid1.jpg",
        "compressKey": "users/user-uuid/compressed/uuid1.webp",
        "size": 1024000,
        "mimetype": "image/jpeg",
        "mtime": "2024-01-01T00:00:00.000Z"
      },
      "sortIndex": 0,
      "userid": "user-uuid",
      "roteid": "note-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "attachment-uuid-2",
      "url": "https://storage.example.com/users/user-uuid/uploads/uuid2.png",
      "compressUrl": "https://storage.example.com/users/user-uuid/compressed/uuid2.webp",
      "storage": "R2",
      "details": {
        "key": "users/user-uuid/uploads/uuid2.png",
        "compressKey": "users/user-uuid/compressed/uuid2.webp",
        "size": 512000,
        "mimetype": "image/png",
        "mtime": "2024-01-01T00:00:00.000Z"
      },
      "sortIndex": 1,
      "userid": "user-uuid",
      "roteid": "note-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

可能的错误：

- 400 未上传文件
- 400 文件大小超限
- 401 未认证
- 500 对象存储未配置

---

## 2) 获取预签名上传 URL（推荐方式）

获取预签名 URL，前端直接上传到对象存储，减少服务器负载。

- **方法**: POST
- **URL**: `/v2/api/attachments/presign`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `files`: 文件信息数组，每个文件包含：
    - `filename` (可选): 文件名（最大 255 个字符）
    - `contentType` (必填): MIME 类型（如 `"image/jpeg"`），必须是允许的图片类型
    - `size` (必填): 文件大小（字节），必须大于 0 且不超过 20MB
- **限制**:
  - 单次最多请求 9 个文件
  - 单个文件最大 20MB
  - 支持图片格式：JPEG、PNG、WebP、GIF、HEIC、HEIF、AVIF、SVG

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/attachments/presign' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "files": [
      {
        "filename": "image1.jpg",
        "contentType": "image/jpeg",
        "size": 1024000
      },
      {
        "filename": "image2.png",
        "contentType": "image/png",
        "size": 512000
      }
    ]
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "uuid": "generated-uuid-1",
        "original": {
          "key": "users/user-uuid/uploads/uuid1.jpg",
          "putUrl": "https://storage.example.com/presigned-put-url-1",
          "url": "https://storage.example.com/users/user-uuid/uploads/uuid1.jpg",
          "contentType": "image/jpeg"
        },
        "compressed": {
          "key": "users/user-uuid/compressed/uuid1.webp",
          "putUrl": "https://storage.example.com/presigned-put-url-2",
          "url": "https://storage.example.com/users/user-uuid/compressed/uuid1.webp",
          "contentType": "image/webp"
        }
      },
      {
        "uuid": "generated-uuid-2",
        "original": {
          "key": "users/user-uuid/uploads/uuid2.png",
          "putUrl": "https://storage.example.com/presigned-put-url-3",
          "url": "https://storage.example.com/users/user-uuid/uploads/uuid2.png",
          "contentType": "image/png"
        },
        "compressed": {
          "key": "users/user-uuid/compressed/uuid2.webp",
          "putUrl": "https://storage.example.com/presigned-put-url-4",
          "url": "https://storage.example.com/users/user-uuid/compressed/uuid2.webp",
          "contentType": "image/webp"
        }
      }
    ]
  }
}
```

**使用流程**：

1. 调用 `/presign` 接口获取预签名 URL
2. 前端使用 `PUT` 方法将文件上传到 `original.putUrl`（原始文件）
3. 服务器会自动生成压缩版本（WebP 格式），压缩文件会通过 `compressed.putUrl` 上传
4. 上传完成后，调用 `/finalize` 接口将附件信息保存到数据库

**前端上传示例**：

```javascript
// 1. 获取预签名 URL
const presignResponse = await fetch("/v2/api/attachments/presign", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    files: [
      { filename: "image.jpg", contentType: "image/jpeg", size: file.size },
    ],
  }),
});

const { items } = presignResponse.data;

// 2. 上传原始文件到预签名 URL
await fetch(items[0].original.putUrl, {
  method: "PUT",
  body: file,
  headers: {
    "Content-Type": items[0].original.contentType,
  },
});

// 3. 上传压缩文件（如果需要，通常由服务器处理）
// await fetch(items[0].compressed.putUrl, { ... });

// 4. 调用 finalize 接口保存附件信息
await fetch("/v2/api/attachments/finalize", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    attachments: [
      {
        uuid: items[0].uuid,
        originalKey: items[0].original.key,
        compressedKey: items[0].compressed.key,
        size: file.size,
        mimetype: file.type,
      },
    ],
    noteId: "optional-note-id",
  }),
});
```

可能的错误：

- 400 文件列表为空
- 400 文件数量超过限制（最多 9 个文件）
- 400 缺少内容类型 (contentType)
- 400 不允许的内容类型（contentType 不在允许列表中）
- 400 缺少文件大小 (size)
- 400 文件大小必须大于 0
- 400 文件大小超过限制（超过 20MB）
- 400 文件名超过 255 个字符
- 401 未认证
- 500 对象存储未配置

---

## 3) 完成附件上传（入库）

将已通过预签名 URL 上传的文件信息保存到数据库。

- **方法**: POST
- **URL**: `/v2/api/attachments/finalize`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `attachments`: 附件信息数组，每个附件包含：
    - `uuid`: 文件 UUID（从 `/presign` 接口返回）
    - `originalKey`: 原始文件的对象存储 Key（从 `/presign` 接口返回）
    - `compressedKey` (可选): 压缩文件的对象存储 Key
    - `size` (可选): 文件大小（字节）
    - `mimetype` (可选): MIME 类型
    - `hash` (可选): 文件哈希值
  - `noteId` (可选): 笔记 ID（UUID 格式），如果提供，附件将绑定到该笔记
- **限制**:
  - 单次最多处理 100 个附件

**特性**：

- 支持幂等操作：如果附件已存在（通过 `originalKey` 匹配），则更新压缩信息，不会重复创建
- 如果附件已存在但未绑定笔记，可以通过 `noteId` 参数进行绑定

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/attachments/finalize' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "attachments": [
      {
        "uuid": "generated-uuid-1",
        "originalKey": "users/user-uuid/uploads/uuid1.jpg",
        "compressedKey": "users/user-uuid/compressed/uuid1.webp",
        "size": 1024000,
        "mimetype": "image/jpeg"
      }
    ],
    "noteId": "note-uuid"
  }'
```

成功响应示例（201）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "attachment-uuid",
      "url": "https://storage.example.com/users/user-uuid/uploads/uuid1.jpg",
      "compressUrl": "https://storage.example.com/users/user-uuid/compressed/uuid1.webp",
      "storage": "R2",
      "details": {
        "key": "users/user-uuid/uploads/uuid1.jpg",
        "compressKey": "users/user-uuid/compressed/uuid1.webp",
        "size": 1024000,
        "mimetype": "image/jpeg",
        "mtime": "2024-01-01T00:00:00.000Z"
      },
      "sortIndex": 0,
      "userid": "user-uuid",
      "roteid": "note-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

可能的错误：

- 400 附件列表为空
- 400 附件数量超过限制（最多 100 个附件）
- 400 无效的对象 Key（Key 必须属于当前用户）
- 401 未认证
- 500 对象存储未配置

---

## 4) 删除单个附件

删除指定的附件，同时会从对象存储中删除文件。

- **方法**: DELETE
- **URL**: `/v2/api/attachments/:id`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
- **路径参数**:
  - `id`: 附件 ID（UUID 格式）

**特性**：

- 只能删除当前用户拥有的附件
- 删除附件时，会同时删除对象存储中的原始文件和压缩文件
- 如果附件绑定到笔记，删除后会更新笔记的 `updatedAt` 并记录变更历史

请求示例（cURL）:

```bash
curl -X DELETE 'https://your-domain.com/v2/api/attachments/attachment-uuid' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "count": 1
  }
}
```

可能的错误：

- 400 无效的附件 ID
- 401 未认证
- 404 附件不存在或无权访问

---

## 5) 批量删除附件

批量删除多个附件，同时会从对象存储中删除文件。

- **方法**: DELETE
- **URL**: `/v2/api/attachments/`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `ids`: 附件 ID 数组（UUID 格式数组，字符串数组）
- **限制**:
  - 单次最多删除 100 个附件

**特性**：

- 只能删除当前用户拥有的附件
- 删除附件时，会同时删除对象存储中的原始文件和压缩文件
- 如果附件绑定到笔记，删除后会更新相关笔记的 `updatedAt` 并记录变更历史

请求示例（cURL）:

```bash
curl -X DELETE 'https://your-domain.com/v2/api/attachments/' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "ids": ["attachment-uuid-1", "attachment-uuid-2", "attachment-uuid-3"]
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "count": 3
  }
}
```

可能的错误：

- 400 附件列表为空
- 400 附件数量超过限制（最多 100 个附件）
- 400 部分附件不存在或无权访问
- 401 未认证

---

## 6) 更新附件排序

更新指定笔记中附件的显示顺序。

- **方法**: PUT
- **URL**: `/v2/api/attachments/sort`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `roteId`: 笔记 ID（UUID 格式）
  - `attachmentIds`: 附件 ID 数组（UUID 格式数组），按期望的排序顺序排列
- **限制**:
  - 单次最多更新 100 个附件的排序

**特性**：

- 所有附件必须属于当前用户且绑定到指定的笔记
- 排序索引按照 `attachmentIds` 数组的顺序设置（从 0 开始）
- 更新排序后会更新笔记的 `updatedAt` 并记录变更历史

请求示例（cURL）:

```bash
curl -X PUT 'https://your-domain.com/v2/api/attachments/sort' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "roteId": "note-uuid",
    "attachmentIds": ["attachment-uuid-3", "attachment-uuid-1", "attachment-uuid-2"]
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "attachment-uuid-3",
      "sortIndex": 0,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "attachment-uuid-1",
      "sortIndex": 1,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "attachment-uuid-2",
      "sortIndex": 2,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

可能的错误：

- 400 无效的笔记 ID
- 400 无效的附件 ID 列表
- 400 附件数量超过限制（最多 100 个附件）
- 400 部分附件不存在、不属于用户或未绑定到指定笔记
- 401 未认证

---

## 使用建议

### 上传方式选择

1. **传统上传**（`POST /`）：

   - 适用于简单场景
   - 文件较小（< 5MB）
   - 不需要精细控制上传过程

2. **预签名直传**（`POST /presign` + `POST /finalize`）：
   - 推荐用于生产环境
   - 文件较大（> 5MB）
   - 需要更好的上传性能和用户体验
   - 支持断点续传（需要前端实现）

### 附件绑定笔记

- 可以在上传时通过 `noteId` 参数直接绑定到笔记
- 也可以先上传附件（不绑定），后续再通过笔记更新接口绑定
- 附件可以随时从笔记中解绑（通过更新笔记的 `attachmentIds` 字段）

### 图片压缩

- 系统会自动为图片生成 WebP 格式的压缩版本
- 压缩文件存储在 `compressUrl` 字段中
- 前端可以根据需要选择使用原始图片或压缩图片

### 错误处理

- 所有接口都遵循统一的错误响应格式
- 建议在前端实现重试机制，特别是上传接口
- 删除操作失败时，对象存储中的文件可能仍存在，需要定期清理

---

## 错误响应

### 400 Bad Request

```json
{
  "code": 400,
  "message": "No images uploaded",
  "data": null
}
```

### 401 Unauthorized

```json
{
  "code": 401,
  "message": "Authentication required",
  "data": null
}
```

### 404 Not Found

```json
{
  "code": 404,
  "message": "Attachment not found",
  "data": null
}
```

### 500 Internal Server Error

```json
{
  "code": 500,
  "message": "R2 storage is not configured",
  "data": null
}
```
