#!/usr/bin/env bun
/**
 * i18n 翻译键检查工具入口
 *
 * 使用方法：
 *   bun run scripts/i18nChecker/index.ts analyze   # 分析未使用的键
 *   bun run scripts/i18nChecker/index.ts remove    # 删除未使用的键
 */

// 使文件成为模块以支持顶层 await
export {};

// Bun 环境中的全局类型声明
declare const process: {
  argv: string[];
  exit(code?: number): never;
};

const command = process.argv[2] || "";

if (!command || (command !== "analyze" && command !== "remove")) {
  console.log("i18n 翻译键检查工具");
  console.log("");
  console.log("使用方法：");
  console.log(
    "  bun run scripts/i18nChecker/index.ts analyze   # 分析未使用的翻译键"
  );
  console.log(
    "  bun run scripts/i18nChecker/index.ts remove   # 删除未使用的翻译键"
  );
  console.log("");
  console.log("更多信息请查看 README.md");
  process.exit(1);
}

// 直接导入并执行对应的脚本
if (command === "analyze") {
  await import("./analyze-unused-translations.ts");
} else if (command === "remove") {
  await import("./remove-unused-translations.ts");
}
