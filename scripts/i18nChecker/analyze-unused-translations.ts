#!/usr/bin/env bun
/**
 * 分析未使用的翻译键
 * 扫描代码库，找出翻译文件中定义但未在代码中使用的键
 */

/// <reference types="node" />

import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 支持的语言配置
const SUPPORTED_LANGUAGES = [
  { code: "zh", name: "中文", file: "zh.json" },
  { code: "en", name: "英文", file: "en.json" },
  { code: "ja", name: "日语", file: "ja.json" },
] as const;

// 检查键是否被使用的辅助函数
function isKeyUsed(key: string, allUsedKeys: Set<string>): boolean {
  // 直接匹配
  if (allUsedKeys.has(key)) {
    return true;
  }

  // 检查父路径或子路径匹配
  for (const usedKey of allUsedKeys) {
    if (
      usedKey === key ||
      usedKey.startsWith(key + ".") ||
      key.startsWith(usedKey + ".")
    ) {
      return true;
    }
  }

  // 特殊处理：检查键是否在子路径中被使用
  // 例如：代码使用 pages.login.usernameRequired，但翻译文件中有 pages.login.validation.usernameRequired
  const keyParts = key.split(".");
  for (let i = keyParts.length - 1; i > 0; i--) {
    const parentPath = keyParts.slice(0, i).join(".");
    const childKey = keyParts.slice(i).join(".");
    for (const usedKey of allUsedKeys) {
      if (usedKey === `${parentPath}.${childKey}` || usedKey === childKey) {
        return true;
      }
    }
  }

  return false;
}

// 找出未使用的键
function findUnusedKeys(
  translationKeys: Set<string>,
  allUsedKeys: Set<string>
): Set<string> {
  const unusedKeys = new Set<string>();
  translationKeys.forEach((key) => {
    if (!isKeyUsed(key, allUsedKeys)) {
      unusedKeys.add(key);
    }
  });
  return unusedKeys;
}

// 递归获取所有文件路径
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = join(dirPath, file);
    if (statSync(filePath).isDirectory()) {
      // 跳过 node_modules 和 dist 目录
      if (file !== "node_modules" && file !== "dist" && file !== ".git") {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// 从 JSON 对象中提取所有键路径
function extractKeys(obj: any, prefix = ""): Set<string> {
  const keys = new Set<string>();

  if (Array.isArray(obj)) {
    // 对于数组，记录索引路径
    obj.forEach((item, index) => {
      const newPrefix = prefix ? `${prefix}.${index}` : `${index}`;
      if (typeof item === "object" && item !== null) {
        extractKeys(item, newPrefix).forEach((k) => keys.add(k));
      } else {
        keys.add(newPrefix);
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    Object.keys(obj).forEach((key) => {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (typeof value === "object" && value !== null) {
        extractKeys(value, newPrefix).forEach((k) => keys.add(k));
      } else {
        keys.add(newPrefix);
      }
    });
  }

  return keys;
}

// 从代码中提取使用的翻译键
function extractUsedKeys(filePath: string): Set<string> {
  const content = readFileSync(filePath, "utf-8");
  const usedKeys = new Set<string>();

  // 匹配 useTranslation 调用，提取 keyPrefix
  const keyPrefixRegex =
    /useTranslation\(['"]([^'"]+)['"],\s*\{[^}]*keyPrefix:\s*['"]([^'"]+)['"]/g;
  const keyPrefixMap = new Map<number, string>(); // 行号 -> keyPrefix

  let match;
  while ((match = keyPrefixRegex.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    keyPrefixMap.set(lineNumber, match[2]);
  }

  // 匹配 t('...') 或 t("...") 调用
  const tCallRegex = /t\(['"]([^'"]+)['"]/g;
  while ((match = tCallRegex.exec(content)) !== null) {
    const key = match[1];
    const lineNumber = content.substring(0, match.index).split("\n").length;

    // 查找最近的 keyPrefix
    let currentPrefix = "";
    for (const [line, prefix] of keyPrefixMap.entries()) {
      if (line <= lineNumber) {
        currentPrefix = prefix;
      } else {
        break;
      }
    }

    // 组合完整路径
    const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key;
    usedKeys.add(fullKey);

    // 处理数组索引访问（如 linksItems.0 或直接的数字索引 0）
    if (/^\d+$/.test(key)) {
      // 这是一个纯数字索引，需要特殊处理
      // 我们保留父路径
      const parentKey = currentPrefix;
      if (parentKey) {
        // 添加父路径本身（数组整体）
        usedKeys.add(parentKey);
      }
    } else if (/\.\d+$/.test(key)) {
      // 处理带路径的数组索引访问（如 linksItems.0）
      // 提取父路径（如 linksItems）
      const keyParts = key.split(".");
      const lastPart = keyParts[keyParts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        // 最后一部分是数字索引
        const parentKeyPath = keyParts.slice(0, -1).join(".");
        const fullParentKey = currentPrefix
          ? `${currentPrefix}.${parentKeyPath}`
          : parentKeyPath;
        // 添加父路径本身（数组整体）
        usedKeys.add(fullParentKey);
      }
    }
  }

  // 匹配 i18n.t('...') 或 i18n.t("...") 调用（直接访问全局翻译，不使用 keyPrefix）
  const i18nTCallRegex = /i18n\.t\(['"]([^'"]+)['"]/g;
  while ((match = i18nTCallRegex.exec(content)) !== null) {
    const key = match[1];
    // i18n.t() 直接使用完整路径，不需要 keyPrefix
    usedKeys.add(key);

    // 处理数组索引访问
    if (/\.\d+$/.test(key)) {
      const keyParts = key.split(".");
      const lastPart = keyParts[keyParts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        const parentKeyPath = keyParts.slice(0, -1).join(".");
        if (parentKeyPath) {
          usedKeys.add(parentKeyPath);
        }
      }
    }
  }

  // 匹配 translate('...') 调用（formatTimeAgo 函数中使用的包装函数）
  const translateCallRegex = /translate\(['"]([^'"]+)['"]/g;
  while ((match = translateCallRegex.exec(content)) !== null) {
    const key = match[1];
    // translate() 直接使用完整路径，不需要 keyPrefix
    usedKeys.add(key);
  }

  // 特殊处理：如果代码中包含 formatTimeAgo 函数，自动添加 common.timeAgo.* 键
  // 因为 formatTimeAgo 函数内部使用了这些键
  if (
    content.includes("formatTimeAgo") ||
    content.includes("function formatTimeAgo")
  ) {
    const timeAgoKeys = [
      "common.timeAgo.justNow",
      "common.timeAgo.secondsAgo",
      "common.timeAgo.minutesAgo",
      "common.timeAgo.minutesAgo_plural",
      "common.timeAgo.hoursAgo",
      "common.timeAgo.hoursAgo_plural",
      "common.timeAgo.daysAgo",
      "common.timeAgo.daysAgo_plural",
      "common.timeAgo.weeksAgo",
      "common.timeAgo.weeksAgo_plural",
      "common.timeAgo.monthsAgo",
      "common.timeAgo.monthsAgo_plural",
      "common.timeAgo.yearsAgo",
      "common.timeAgo.yearsAgo_plural",
    ];
    timeAgoKeys.forEach((key) => usedKeys.add(key));
  }

  // 匹配 i18n.t(`...`) 模板字符串调用
  const i18nTTemplateRegex = /i18n\.t\(`([^`]+)`/g;
  while ((match = i18nTTemplateRegex.exec(content)) !== null) {
    const template = match[1];
    // 处理模板字符串中的变量（如 common.timeAgo.${key}）
    // 对于 common.timeAgo.* 这种情况，添加所有可能的键
    if (template.includes("common.timeAgo.")) {
      const timeAgoKeys = [
        "common.timeAgo.justNow",
        "common.timeAgo.secondsAgo",
        "common.timeAgo.minutesAgo",
        "common.timeAgo.minutesAgo_plural",
        "common.timeAgo.hoursAgo",
        "common.timeAgo.hoursAgo_plural",
        "common.timeAgo.daysAgo",
        "common.timeAgo.daysAgo_plural",
        "common.timeAgo.weeksAgo",
        "common.timeAgo.weeksAgo_plural",
        "common.timeAgo.monthsAgo",
        "common.timeAgo.monthsAgo_plural",
        "common.timeAgo.yearsAgo",
        "common.timeAgo.yearsAgo_plural",
      ];
      timeAgoKeys.forEach((key) => usedKeys.add(key));
    } else if (!template.includes("${")) {
      // 如果没有变量，直接使用
      usedKeys.add(template);
    }
  }

  // 匹配模板字符串中的动态键（如 t(`settings.oauth.${provider}.bind`)）
  const templateStringRegex = /t\(`([^`]+)`/g;
  while ((match = templateStringRegex.exec(content)) !== null) {
    const template = match[1];
    const lineNumber = content.substring(0, match.index).split("\n").length;

    // 查找最近的 keyPrefix
    let currentPrefix = "";
    for (const [line, prefix] of keyPrefixMap.entries()) {
      if (line <= lineNumber) {
        currentPrefix = prefix;
      } else {
        break;
      }
    }

    // 提取可能的键模式（如 settings.oauth.${provider}.bind 或 leftNavBar.${icon.name}）
    // 对于包含 ${} 的模板，我们需要添加所有可能的组合
    if (template.includes("${provider}")) {
      // 替换 ${provider} 为可能的提供商
      const providers = ["github", "apple"];
      providers.forEach((provider) => {
        const resolvedKey = template.replace(/\$\{provider\}/g, provider);
        // 移除其他变量引用，只保留已知的键模式
        if (!resolvedKey.includes("${")) {
          const fullKey = currentPrefix
            ? `${currentPrefix}.${resolvedKey}`
            : resolvedKey;
          usedKeys.add(fullKey);
        }
      });
    } else if (
      template.includes("${icon.name}") ||
      template.includes("${iconName}")
    ) {
      // 处理 leftNavBar.${icon.name} 这种情况
      // 根据代码中的定义，icon.name 可能是：home, explore, archived, profile, experiment, admin, logout, login, fold
      const iconNames = [
        "home",
        "explore",
        "archived",
        "profile",
        "experiment",
        "admin",
        "logout",
        "login",
        "fold",
      ];
      iconNames.forEach((iconName) => {
        const resolvedKey = template
          .replace(/\$\{icon\.name\}/g, iconName)
          .replace(/\$\{iconName\}/g, iconName);
        if (!resolvedKey.includes("${")) {
          const fullKey = currentPrefix
            ? `${currentPrefix}.${resolvedKey}`
            : resolvedKey;
          usedKeys.add(fullKey);
        }
      });
    } else if (
      template.includes("${rote.state}") ||
      template.includes("${state}")
    ) {
      // 处理 stateOptions.${rote.state} 这种情况
      const basePath = template.split("${")[0];
      if (basePath && basePath.endsWith(".")) {
        const fullKey = currentPrefix
          ? `${currentPrefix}.${basePath.slice(0, -1)}`
          : basePath.slice(0, -1);
        // stateOptions 的可能值
        const stateValues = ["public", "private"];
        stateValues.forEach((state) => {
          usedKeys.add(`${fullKey}.${state}`);
        });
      }
    } else if (template.includes("${")) {
      // 对于其他包含变量的模板，尝试提取基础路径
      // 例如：leftNavBar.${icon.name} -> leftNavBar.*
      const basePath = template.split("${")[0];
      if (basePath && basePath.endsWith(".")) {
        // 如果基础路径以 . 结尾，说明后面是变量，添加通配符匹配
        const fullKey = currentPrefix
          ? `${currentPrefix}.${basePath.slice(0, -1)}`
          : basePath.slice(0, -1);
        // 添加所有可能的子键（基于常见模式）
        const commonKeys = [
          "home",
          "explore",
          "archived",
          "profile",
          "experiment",
          "admin",
          "logout",
          "login",
          "fold",
        ];
        commonKeys.forEach((key) => {
          usedKeys.add(`${fullKey}.${key}`);
        });
      }
    } else if (!template.includes("${")) {
      // 没有变量的模板字符串，直接使用
      const fullKey = currentPrefix ? `${currentPrefix}.${template}` : template;
      usedKeys.add(fullKey);
    }
  }

  // 匹配动态键（如 `buttons.loginWith${provider}`）
  const dynamicKeyRegex = /t\([`'"]buttons\.loginWith\$\{([^}]+)\}/g;
  while ((match = dynamicKeyRegex.exec(content)) !== null) {
    // 添加可能的动态键模式
    usedKeys.add("pages.login.buttons.loginWithGitHub");
    usedKeys.add("pages.login.buttons.loginWithApple");
  }

  // 匹配其他可能的动态模式
  const otherDynamicRegex = /t\([`'"]pages\.login\.buttons\.loginWith(\w+)/g;
  while ((match = otherDynamicRegex.exec(content)) !== null) {
    usedKeys.add(`pages.login.buttons.loginWith${match[1]}`);
  }

  // 匹配通过变量访问的键（如 t(providerInfo.labelKey)）
  // 查找 labelKey 的定义和使用
  const labelKeyRegex = /labelKey:\s*['"]([^'"]+)['"]/g;
  while ((match = labelKeyRegex.exec(content)) !== null) {
    const labelKey = match[1];
    // 如果 labelKey 是相对路径，需要加上 keyPrefix
    if (labelKey.startsWith("buttons.")) {
      usedKeys.add(`pages.login.${labelKey}`);
    } else if (labelKey.startsWith("pages.")) {
      usedKeys.add(labelKey);
    }
  }

  // 匹配变量定义（如 const fallbackKey = 'settings.oauth.unbindSuccess'）
  // 存储所有变量定义，包括位置信息
  const variableDefs: Array<{ name: string; value: string; position: number }> =
    [];
  const varDefRegex = /(?:const|let|var)\s+(\w+)\s*[:=]\s*['"]([^'"]+)['"]/g;
  while ((match = varDefRegex.exec(content)) !== null) {
    variableDefs.push({
      name: match[1],
      value: match[2],
      position: match.index,
    });
  }

  // 匹配对象字面量中的字符串键（如 title: 'pages.setupWizard.steps.basic.title'）
  // 这些键可能通过对象属性访问（如 t(step.title)）
  const objPropertyRegex =
    /(?:title|description|labelKey|key):\s*['"]([^'"]+)['"]/g;
  while ((match = objPropertyRegex.exec(content)) !== null) {
    const key = match[1];
    // 如果键是完整路径（以 pages. 或 components. 开头），直接添加
    if (key.startsWith("pages.") || key.startsWith("components.")) {
      usedKeys.add(key);
    }
  }

  // 匹配 t(variable) 或 t(variable, {...}) 形式的调用，查找变量定义
  // 匹配模式：t(variable) 或 t(variable, ...)
  const tVariableRegex = /t\((\w+)(?:\)|,)/g;
  while ((match = tVariableRegex.exec(content)) !== null) {
    const varName = match[1];
    const callPosition = match.index;
    const lineNumber = content.substring(0, callPosition).split("\n").length;

    // 查找最近的变量定义（在调用之前的最后一个定义）
    let varValue: string | null = null;
    for (let i = variableDefs.length - 1; i >= 0; i--) {
      const def = variableDefs[i];
      if (def.name === varName && def.position < callPosition) {
        varValue = def.value;
        break;
      }
    }

    if (varValue) {
      // 查找最近的 keyPrefix
      let currentPrefix = "";
      for (const [line, prefix] of keyPrefixMap.entries()) {
        if (line <= lineNumber) {
          currentPrefix = prefix;
        } else {
          break;
        }
      }
      // 组合完整路径
      // 如果变量值已经是完整路径（以 pages. 开头），直接使用
      // 否则加上 keyPrefix
      let fullKey: string;
      if (varValue.startsWith("pages.") || varValue.startsWith("components.")) {
        fullKey = varValue;
      } else {
        fullKey = currentPrefix ? `${currentPrefix}.${varValue}` : varValue;
      }
      usedKeys.add(fullKey);
    }
  }

  // 查找对象属性中的 labelKey
  const objLabelKeyRegex = /labelKey:\s*['"]([^'"]+)['"]/g;
  let objMatch;
  while ((objMatch = objLabelKeyRegex.exec(content)) !== null) {
    const key = objMatch[1];
    // 检查是否在 pages.login 上下文中
    if (key.includes("buttons.loginWith")) {
      usedKeys.add(`pages.login.${key}`);
    }
  }

  return usedKeys;
}

// 主函数
function main() {
  const webSrcPath = join(process.cwd(), "web/src");
  const localesPath = join(webSrcPath, "locales");

  // 读取所有语言的翻译文件
  const languageData = new Map<
    string,
    { name: string; json: any; keys: Set<string> }
  >();

  for (const lang of SUPPORTED_LANGUAGES) {
    const jsonPath = join(localesPath, lang.file);
    try {
      const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
      const keys = extractKeys(json);
      languageData.set(lang.code, {
        name: lang.name,
        json,
        keys,
      });
      console.log(`${lang.name}翻译文件中共有 ${keys.size} 个键`);
    } catch (error) {
      console.error(`读取${lang.name}翻译文件失败: ${jsonPath}`, error);
      process.exit(1);
    }
  }

  // 获取所有源代码文件
  const sourceFiles = getAllFiles(webSrcPath);
  console.log(`扫描 ${sourceFiles.length} 个源代码文件...`);

  // 提取所有使用的键
  const allUsedKeys = new Set<string>();
  sourceFiles.forEach((file) => {
    try {
      const usedKeys = extractUsedKeys(file);
      usedKeys.forEach((key) => allUsedKeys.add(key));
    } catch (error) {
      console.error(`读取文件失败: ${file}`, error);
    }
  });

  console.log(`代码中使用了 ${allUsedKeys.size} 个不同的键`);

  // 找出所有语言的未使用键
  const unusedKeysByLang = new Map<string, Set<string>>();
  for (const [langCode, langData] of languageData.entries()) {
    const unusedKeys = findUnusedKeys(langData.keys, allUsedKeys);
    unusedKeysByLang.set(langCode, unusedKeys);
  }

  // 找出所有文件中都未使用的键（需要同步删除）
  const unusedInAll = new Set<string>();
  const firstLangCode = SUPPORTED_LANGUAGES[0].code;
  const firstUnusedKeys = unusedKeysByLang.get(firstLangCode)!;

  firstUnusedKeys.forEach((key) => {
    // 检查该键是否在所有语言中都未使用
    const isUnusedInAll = Array.from(unusedKeysByLang.values()).every(
      (unusedKeys) => unusedKeys.has(key)
    );
    if (isUnusedInAll) {
      unusedInAll.add(key);
    }
  });

  console.log("\n=== 分析结果 ===");
  for (const lang of SUPPORTED_LANGUAGES) {
    const unusedCount = unusedKeysByLang.get(lang.code)?.size ?? 0;
    console.log(`${lang.name}文件中未使用的键: ${unusedCount}`);
  }
  console.log(`所有文件中都未使用的键: ${unusedInAll.size}`);

  // 输出未使用的键列表
  if (unusedInAll.size > 0) {
    console.log("\n=== 建议删除的键（所有文件都未使用）===");
    const sortedKeys = Array.from(unusedInAll).sort();
    sortedKeys.forEach((key) => {
      console.log(`  - ${key}`);
    });

    // 保存到文件
    const outputPath = join(__dirname, "unused-translation-keys.json");
    const output: any = {
      unusedInAll: sortedKeys,
      stats: {
        usedKeys: allUsedKeys.size,
        unusedInAll: unusedInAll.size,
      },
    };

    // 为每种语言添加统计信息
    for (const lang of SUPPORTED_LANGUAGES) {
      const langData = languageData.get(lang.code)!;
      const unusedKeys = unusedKeysByLang.get(lang.code)!;
      const unusedOnly = Array.from(unusedKeys)
        .filter((k) => !unusedInAll.has(k))
        .sort();

      output[`unused${lang.code.toUpperCase()}Only`] = unusedOnly;
      output.stats[`total${lang.code.toUpperCase()}Keys`] = langData.keys.size;
      output.stats[`unused${lang.code.toUpperCase()}Keys`] = unusedKeys.size;
    }
    writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n详细报告已保存到: ${outputPath}`);
  } else {
    console.log("\n没有发现未使用的翻译键！");
  }
}

main();
