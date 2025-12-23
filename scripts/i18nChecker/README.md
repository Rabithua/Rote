# i18n 翻译键检查工具

这个工具集用于分析和清理项目中未使用的翻译键，帮助保持翻译文件的整洁和可维护性。

## 工具说明

### 1. `analyze-unused-translations.ts`

分析脚本，扫描代码库并识别未使用的翻译键。

**功能：**

- 扫描所有 TypeScript/TSX 源代码文件
- 提取代码中使用的所有翻译键
- 对比翻译文件（`zh.json` 和 `en.json`）中定义的键
- 识别未使用的键，包括：
  - 两个文件中都未使用的键
  - 仅在中文文件中未使用的键
  - 仅在英文文件中未使用的键
- 生成详细的 JSON 报告文件

**支持的翻译键模式：**

- 直接字符串键：`t('key')`
- 模板字符串：`t(\`key.${var}\`)`
- 变量键：`t(fallbackKey)`（通过变量定义识别）
- 对象属性键：`t(step.title)`（识别对象字面量中的字符串值）
- 动态键：`t(\`settings.oauth.${provider}.bind\`)`
- keyPrefix 支持：自动识别 `useTranslation` 中的 `keyPrefix`

**使用方法：**

```bash
# 方式 1：使用 npm scripts（推荐，需要在 scripts/i18nChecker 目录下）
cd scripts/i18nChecker
bun run analyze

# 方式 2：使用入口脚本（从项目根目录）
bun run scripts/i18nChecker/index.ts analyze

# 方式 3：直接运行脚本
bun run scripts/i18nChecker/analyze-unused-translations.ts
```

**输出：**

- 控制台输出：统计信息和未使用的键列表
- `scripts/i18nChecker/unused-translation-keys.json`：详细的 JSON 报告文件

### 2. `remove-unused-translations.ts`

删除脚本，根据分析结果删除未使用的翻译键。

**功能：**

- 读取 `unused-translation-keys.json` 报告文件
- 从 `zh.json` 和 `en.json` 中删除未使用的键
- 自动清理空对象和空数组
- 保持 JSON 格式的完整性

**使用方法：**

```bash
# 方式 1：使用 npm scripts（推荐，需要在 scripts/i18nChecker 目录下）
cd scripts/i18nChecker
bun run remove

# 方式 2：使用入口脚本（从项目根目录）
bun run scripts/i18nChecker/index.ts remove

# 方式 3：直接运行脚本
bun run scripts/i18nChecker/remove-unused-translations.ts
```

**注意事项：**

- 删除操作会直接修改翻译文件，建议先提交代码或备份
- 只会删除两个文件中都未使用的键，避免造成翻译不同步

## 使用流程

### 1. 分析未使用的键

首先运行分析脚本：

```bash
# 从项目根目录
bun run scripts/i18nChecker/index.ts analyze

# 或从 scripts/i18nChecker 目录
cd scripts/i18nChecker && bun run analyze
```

输出示例：

```
中文翻译文件中共有 672 个键
英文翻译文件中共有 670 个键
扫描 131 个源代码文件...
代码中使用了 785 个不同的键

=== 分析结果 ===
中文文件中未使用的键: 2
英文文件中未使用的键: 2
两个文件中都未使用的键: 2

=== 建议删除的键（两个文件都未使用）===
  - pages.landing.linksItems.1
  - pages.landing.linksItems.3

详细报告已保存到: /Users/rabithua/Documents/GitHub/Rote/unused-translation-keys.json
```

### 2. 检查报告文件

查看生成的 `scripts/i18nChecker/unused-translation-keys.json` 文件，确认要删除的键：

```json
{
  "unusedInBoth": ["pages.landing.linksItems.1", "pages.landing.linksItems.3"],
  "unusedZhOnly": [],
  "unusedEnOnly": [],
  "stats": {
    "totalZhKeys": 672,
    "totalEnKeys": 670,
    "usedKeys": 785,
    "unusedZhKeys": 2,
    "unusedEnKeys": 2,
    "unusedInBoth": 2
  }
}
```

### 3. 删除未使用的键

确认无误后，运行删除脚本：

```bash
# 从项目根目录
bun run scripts/i18nChecker/index.ts remove

# 或从 scripts/i18nChecker 目录
cd scripts/i18nChecker && bun run remove
```

输出示例：

```
准备删除 2 个在两个文件中都未使用的键
准备删除 0 个仅在中文文件中未使用的键
准备删除 0 个仅在英文文件中未使用的键

删除完成！
中文文件已删除 2 个键
英文文件已删除 2 个键
```

## 工作原理

### 键提取机制

脚本通过多种正则表达式模式识别代码中的翻译键使用：

1. **直接调用**：`t('key')` 或 `t("key")`
2. **模板字符串**：`t(\`key.${var}\`)`
3. **变量引用**：`t(fallbackKey)` - 通过查找变量定义识别
4. **对象属性**：`t(step.title)` - 识别对象字面量中的字符串值
5. **keyPrefix 支持**：自动应用 `useTranslation` 中的 `keyPrefix`

### 特殊处理

- **动态键**：识别常见的动态模式（如 OAuth 提供商、图标名称等）
- **数组索引**：正确处理数组访问（如 `linksItems.0`）
- **路径匹配**：支持父路径和子路径的匹配，避免误删相关键

## 注意事项

1. **备份文件**：删除操作会直接修改翻译文件，建议先提交代码或备份
2. **代码审查**：删除前请仔细检查报告，确认键确实未使用
3. **动态键**：某些通过复杂逻辑生成的键可能无法自动识别，需要手动检查
4. **测试验证**：删除后建议运行应用测试，确保没有遗漏的键

## 故障排除

### 键被误删

如果发现某些键被误删：

1. 检查代码中是否使用了该键
2. 确认键的使用方式是否被脚本识别（可能需要更新脚本）
3. 从 Git 历史中恢复被删除的键

### 脚本无法识别某些键

如果脚本无法识别某些键的使用：

1. 检查键的使用方式是否符合支持的模式
2. 考虑更新脚本以支持新的使用模式
3. 手动保留这些键，不要删除

## 维护

### 添加新的识别模式

如果需要支持新的翻译键使用模式，可以修改 `analyze-unused-translations.ts` 中的正则表达式或添加新的匹配逻辑。

### 更新动态键列表

如果项目中添加了新的动态键模式（如新的 OAuth 提供商），需要更新脚本中的相关列表。

## 相关文件

- `web/src/locales/zh.json` - 中文翻译文件
- `web/src/locales/en.json` - 英文翻译文件
- `scripts/i18nChecker/unused-translation-keys.json` - 分析报告文件（自动生成）
