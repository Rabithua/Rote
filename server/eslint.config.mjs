import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '**/*.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        Bun: 'readonly',
      },
    },
    plugins: {
      prettier: prettier,
    },
    rules: {
      // JavaScript 规则
      'no-console': 'warn', // 警告使用 console
      'no-debugger': 'warn', // 警告使用 debugger
      'no-empty': 'off', // 关闭空块语句检查
      'no-unused-vars': 'off', // 关闭 JavaScript 的未使用变量检查，使用 TypeScript 版本
      'prefer-const': 'error', // 优先使用 const
      'arrow-body-style': ['error', 'as-needed'], // 箭头函数体只有一个表达式时，省略大括号

      // TypeScript 规则
      '@typescript-eslint/explicit-module-boundary-types': 'off', // 关闭需要显式返回类型的规则
      '@typescript-eslint/no-explicit-any': 'off', // 关闭禁止使用 any 类型的检查
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ], // 禁止未使用的变量，忽略以下划线开头的参数、变量和错误

      // Prettier 规则
      'prettier/prettier': ['error', {}, { usePrettierrc: true }], // 使用 .prettierrc 文件中的配置
    },
  },
  // scripts 和 tests 目录允许使用 console（脚本和测试文件通常需要 console 输出）
  {
    files: ['scripts/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off', // 脚本和测试文件中允许使用 console
    },
  },
  // 服务器端代码允许使用 console（用于日志记录）
  {
    files: ['middleware/**/*.{ts,tsx}', 'route/**/*.{ts,tsx}', 'server.ts', 'utils/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off', // 服务器端代码中允许使用 console 进行日志记录
    },
  }
);
