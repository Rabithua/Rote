# Rote API 测试套件

完整的 API 测试系统，包含从登录到测试所有接口再到登出的完整流程。

## 目录结构

```
tests/
├── index.ts              # 主测试运行器
├── auth.test.ts          # 认证相关 API 测试
├── note.test.ts          # 笔记相关 API 测试
├── user.test.ts          # 用户相关 API 测试
├── apikey.test.ts        # API Key 相关 API 测试
└── utils/
    ├── testClient.ts     # HTTP 测试客户端
    ├── assertions.ts     # 断言工具
    └── testResult.ts     # 测试结果管理
```

## 使用方法

### 基本使用

```bash
# 使用默认账号 (admin/password)
bun run test

# 或使用完整命令
bun run test:full
```

### 自定义测试账号

```bash
# 通过环境变量设置
TEST_USERNAME=myuser TEST_PASSWORD=mypass bun run test
```

### 自定义测试服务器地址

```bash
# 通过环境变量设置
TEST_BASE_URL=http://localhost:3000 bun run test
```

## 测试流程

1. **数据库清理** - 清理测试数据
2. **用户认证** - 使用 admin/password 登录
3. **用户接口测试** - 测试用户相关 API
4. **笔记接口测试** - 测试笔记相关 API
5. **API Key 接口测试** - 测试 API Key 相关 API
6. **认证接口测试** - 测试认证相关 API（刷新令牌等）
7. **错误场景测试** - 测试各种错误处理
8. **清理测试数据** - 删除测试过程中创建的数据
9. **显示测试摘要** - 输出详细的测试结果

## 测试覆盖

### 认证 API (`/auth`)

- ✅ 登录
- ✅ 注册
- ✅ 刷新令牌
- ✅ 修改密码
- ✅ 错误场景

### 用户 API (`/users`)

- ✅ 获取用户信息
- ✅ 获取个人资料
- ✅ 更新个人资料
- ✅ 获取用户标签
- ✅ 获取统计信息
- ✅ 获取热力图数据
- ✅ 导出数据

### 笔记 API (`/notes`)

- ✅ 创建笔记
- ✅ 获取笔记
- ✅ 更新笔记
- ✅ 删除笔记
- ✅ 搜索笔记
- ✅ 获取随机笔记

### API Key API (`/apikeys`)

- ✅ 生成 API Key
- ✅ 获取所有 API Keys
- ✅ 更新 API Key
- ✅ 删除 API Key

## 默认测试账号

- **用户名**: `admin`
- **密码**: `password`

这些默认值可以在 `server/scripts/testConfig.json` 中修改。

## 测试结果

测试运行后会显示：

1. **实时测试输出** - 每个测试的详细执行情况
2. **测试结果摘要** - 总体统计信息
3. **失败测试详情** - 失败的测试及其错误信息
4. **详细测试列表** - 所有测试的完整列表

## 注意事项

1. 确保服务器正在运行（默认 `http://localhost:3000`）
2. 确保数据库连接正常
3. 测试会清理和创建测试数据，请勿在生产环境运行
4. 测试完成后会自动清理创建的测试数据
