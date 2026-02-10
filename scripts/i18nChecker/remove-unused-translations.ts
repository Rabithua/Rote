#!/usr/bin/env bun
/**
 * 删除未使用的翻译键
 */

/// <reference types="node" />

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 从嵌套对象中删除指定路径的键
function removeKey(obj: any, path: string): void {
  const parts = path.split(".");
  let current = obj;

  // 遍历到倒数第二层
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    // 处理数组索引
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      if (Array.isArray(current) && current[index]) {
        current = current[index];
      } else {
        return; // 路径不存在
      }
    } else {
      if (current[part]) {
        current = current[part];
      } else {
        return; // 路径不存在
      }
    }
  }

  // 删除最后一层
  const lastPart = parts[parts.length - 1];
  if (/^\d+$/.test(lastPart)) {
    // 数组索引
    const index = parseInt(lastPart, 10);
    if (Array.isArray(current)) {
      current.splice(index, 1);
    }
  } else {
    // 对象键
    delete current[lastPart];

    // 如果删除后对象为空，尝试删除父对象中的这个键
    if (Object.keys(current).length === 0 && parts.length > 1) {
      const parentPath = parts.slice(0, -1).join(".");
      removeKey(obj, parentPath);
    }
  }
}

// 清理空对象和数组
function cleanEmpty(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .map(cleanEmpty)
      .filter((item) => item !== null && item !== undefined);
  } else if (typeof obj === "object" && obj !== null) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanEmpty(value);
      if (cleanedValue !== null && cleanedValue !== undefined) {
        if (Array.isArray(cleanedValue) && cleanedValue.length > 0) {
          cleaned[key] = cleanedValue;
        } else if (
          typeof cleanedValue === "object" &&
          Object.keys(cleanedValue).length > 0
        ) {
          cleaned[key] = cleanedValue;
        } else if (typeof cleanedValue !== "object") {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }
  return obj;
}

function main() {
  const webSrcPath = join(process.cwd(), "web/src");
  const zhJsonPath = join(webSrcPath, "locales/zh.json");
  const enJsonPath = join(webSrcPath, "locales/en.json");
  const unusedKeysPath = join(__dirname, "unused-translation-keys.json");

  // 读取未使用键列表
  const unusedKeysData = JSON.parse(readFileSync(unusedKeysPath, "utf-8"));
  const unusedInBoth = unusedKeysData.unusedInBoth || [];
  const unusedZhOnly = unusedKeysData.unusedZhOnly || [];
  const unusedEnOnly = unusedKeysData.unusedEnOnly || [];

  // 读取翻译文件
  const zhJson = JSON.parse(readFileSync(zhJsonPath, "utf-8"));
  const enJson = JSON.parse(readFileSync(enJsonPath, "utf-8"));

  console.log(`准备删除 ${unusedInBoth.length} 个在两个文件中都未使用的键`);
  console.log(`准备删除 ${unusedZhOnly.length} 个仅在中文文件中未使用的键`);
  console.log(`准备删除 ${unusedEnOnly.length} 个仅在英文文件中未使用的键`);

  // 删除未使用的键
  const allUnusedZh = [...unusedInBoth, ...unusedZhOnly];
  const allUnusedEn = [...unusedInBoth, ...unusedEnOnly];

  allUnusedZh.forEach((key) => {
    removeKey(zhJson, key);
  });

  allUnusedEn.forEach((key) => {
    removeKey(enJson, key);
  });

  // 清理空对象
  const cleanedZh = cleanEmpty(zhJson);
  const cleanedEn = cleanEmpty(enJson);

  // 写回文件
  writeFileSync(zhJsonPath, JSON.stringify(cleanedZh, null, 2) + "\n", "utf-8");
  writeFileSync(enJsonPath, JSON.stringify(cleanedEn, null, 2) + "\n", "utf-8");

  console.log("\n删除完成！");
  console.log(`中文文件已删除 ${allUnusedZh.length} 个键`);
  console.log(`英文文件已删除 ${allUnusedEn.length} 个键`);
}

main();
