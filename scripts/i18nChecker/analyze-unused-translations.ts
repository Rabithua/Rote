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

    // 处理数组索引访问（如 linksItems.0）
    if (/^\d+$/.test(key)) {
      // 这是一个数字索引，需要特殊处理
      // 我们保留父路径
      const parentKey = currentPrefix;
      if (parentKey) {
        // 添加父路径本身（数组整体）
        usedKeys.add(parentKey);
      }
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
  const zhJsonPath = join(webSrcPath, "locales/zh.json");
  const enJsonPath = join(webSrcPath, "locales/en.json");

  // 读取翻译文件
  const zhJson = JSON.parse(readFileSync(zhJsonPath, "utf-8"));
  const enJson = JSON.parse(readFileSync(enJsonPath, "utf-8"));

  // 提取所有定义的键
  const zhKeys = extractKeys(zhJson);
  const enKeys = extractKeys(enJson);

  console.log(`中文翻译文件中共有 ${zhKeys.size} 个键`);
  console.log(`英文翻译文件中共有 ${enKeys.size} 个键`);

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

  // 找出未使用的键
  const unusedZhKeys = new Set<string>();
  const unusedEnKeys = new Set<string>();

  zhKeys.forEach((key) => {
    // 检查键是否被使用（包括父路径）
    let isUsed = false;
    for (const usedKey of allUsedKeys) {
      if (
        usedKey === key ||
        usedKey.startsWith(key + ".") ||
        key.startsWith(usedKey + ".")
      ) {
        isUsed = true;
        break;
      }
    }

    // 特殊处理：检查键是否在子路径中被使用
    // 例如：代码使用 pages.login.usernameRequired，但翻译文件中有 pages.login.validation.usernameRequired
    // 这种情况下，应该认为键是被使用的（通过父路径访问）
    if (!isUsed) {
      // 检查是否有使用父路径的情况
      const keyParts = key.split(".");
      for (let i = keyParts.length - 1; i > 0; i--) {
        const parentPath = keyParts.slice(0, i).join(".");
        const childKey = keyParts.slice(i).join(".");
        // 检查是否有使用 parentPath.childKey 的情况
        for (const usedKey of allUsedKeys) {
          if (usedKey === `${parentPath}.${childKey}` || usedKey === childKey) {
            isUsed = true;
            break;
          }
        }
        if (isUsed) break;
      }
    }

    if (!isUsed) {
      unusedZhKeys.add(key);
    }
  });

  enKeys.forEach((key) => {
    let isUsed = false;
    for (const usedKey of allUsedKeys) {
      if (
        usedKey === key ||
        usedKey.startsWith(key + ".") ||
        key.startsWith(usedKey + ".")
      ) {
        isUsed = true;
        break;
      }
    }

    // 特殊处理：检查键是否在子路径中被使用
    // 例如：代码使用 pages.login.usernameRequired，但翻译文件中有 pages.login.validation.usernameRequired
    // 这种情况下，应该认为键是被使用的（通过父路径访问）
    if (!isUsed) {
      // 检查是否有使用父路径的情况
      const keyParts = key.split(".");
      for (let i = keyParts.length - 1; i > 0; i--) {
        const parentPath = keyParts.slice(0, i).join(".");
        const childKey = keyParts.slice(i).join(".");
        // 检查是否有使用 parentPath.childKey 的情况
        for (const usedKey of allUsedKeys) {
          if (usedKey === `${parentPath}.${childKey}` || usedKey === childKey) {
            isUsed = true;
            break;
          }
        }
        if (isUsed) break;
      }
    }

    if (!isUsed) {
      unusedEnKeys.add(key);
    }
  });

  // 找出两个文件中都未使用的键（需要同步删除）
  const unusedInBoth = new Set<string>();
  unusedZhKeys.forEach((key) => {
    if (unusedEnKeys.has(key)) {
      unusedInBoth.add(key);
    }
  });

  console.log("\n=== 分析结果 ===");
  console.log(`中文文件中未使用的键: ${unusedZhKeys.size}`);
  console.log(`英文文件中未使用的键: ${unusedEnKeys.size}`);
  console.log(`两个文件中都未使用的键: ${unusedInBoth.size}`);

  // 输出未使用的键列表
  if (unusedInBoth.size > 0) {
    console.log("\n=== 建议删除的键（两个文件都未使用）===");
    const sortedKeys = Array.from(unusedInBoth).sort();
    sortedKeys.forEach((key) => {
      console.log(`  - ${key}`);
    });

    // 保存到文件
    const outputPath = join(__dirname, "unused-translation-keys.json");
    const output = {
      unusedInBoth: sortedKeys,
      unusedZhOnly: Array.from(unusedZhKeys)
        .filter((k) => !unusedInBoth.has(k))
        .sort(),
      unusedEnOnly: Array.from(unusedEnKeys)
        .filter((k) => !unusedInBoth.has(k))
        .sort(),
      stats: {
        totalZhKeys: zhKeys.size,
        totalEnKeys: enKeys.size,
        usedKeys: allUsedKeys.size,
        unusedZhKeys: unusedZhKeys.size,
        unusedEnKeys: unusedEnKeys.size,
        unusedInBoth: unusedInBoth.size,
      },
    };
    writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n详细报告已保存到: ${outputPath}`);
  } else {
    console.log("\n没有发现未使用的翻译键！");
  }
}

main();
