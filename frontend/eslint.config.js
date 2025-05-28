import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src/components/animate-ui/**', 'src/components/ui/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react: react,
      prettier: prettier,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // JavaScript 规则
      'no-console': 'warn', // 警告使用 console
      'no-debugger': 'warn', // 警告使用 debugger
      'no-empty': 'off', // 关闭空块语句检查
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // 禁止未使用的变量，忽略以下划线开头的参数
      'prefer-const': 'error', // 优先使用 const
      'arrow-body-style': ['error', 'as-needed'], // 箭头函数体只有一个表达式时，省略大括号

      // TypeScript 规则
      '@typescript-eslint/explicit-module-boundary-types': 'off', // 关闭需要显式返回类型的规则
      '@typescript-eslint/no-explicit-any': 'off', // 关闭禁止使用 any 类型的检查
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // 禁止未使用的变量，忽略以下划线开头的参数

      // React 规则
      'react/prop-types': 'off', // 关闭 prop-types 检查
      'react/react-in-jsx-scope': 'off', // 不再需要在 JSX 文件中导入 React

      // Prettier 规则
      'prettier/prettier': ['error', {}, { usePrettierrc: true }], // 使用 .prettierrc 文件中的配置
    },
  },
  // Service Worker 特殊配置
  {
    files: ['**/sw.js', '**/service-worker.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.serviceworker,
        self: 'readonly',
        clients: 'readonly',
        registration: 'readonly',
        console: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off', // Service Worker 中允许使用 console
    },
  }
);
