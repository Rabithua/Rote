import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      // 使用 ESLint 推荐的规则集
      'eslint:recommended',
      // 使用 TypeScript ESLint 推荐的规则集
      'plugin:@typescript-eslint/recommended',
      // 使用 React 推荐的规则集
      'plugin:react/recommended',
      // 使用 React Hooks 推荐的规则集
      'plugin:react-hooks/recommended',
      // 使用 JSX 可访问性推荐的规则集
      'plugin:jsx-a11y/recommended',
      // 使用 import 插件的错误和警告规则
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript',
      // 使用 promise 插件推荐的规则集
      'plugin:promise/recommended',
      // 使用 Prettier 推荐的规则集，必须放在最后
      'plugin:prettier/recommended',],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint,
      'react': require('eslint-plugin-react'),
      'jsx-a11y': require('eslint-plugin-jsx-a11y'),
      'import': require('eslint-plugin-import'),
      'promise': require('eslint-plugin-promise'),
      'prettier': require('eslint-plugin-prettier'),
    },
    rules: {
      // JavaScript 规则
      'no-console': 'warn', // 警告使用 console
      'no-debugger': 'warn', // 警告使用 debugger
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // 禁止未使用的变量，忽略以下划线开头的参数
      'prefer-const': 'error', // 优先使用 const
      'arrow-body-style': ['error', 'as-needed'], // 箭头函数体只有一个表达式时，省略大括号

      // TypeScript 规则
      '@typescript-eslint/explicit-module-boundary-types': 'off', // 关闭需要显式返回类型的规则
      '@typescript-eslint/no-explicit-any': 'warn', // 警告使用 any 类型
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // 禁止未使用的变量，忽略以下划线开头的参数

      // React 规则
      'react/prop-types': 'off', // 关闭 prop-types 检查
      'react/react-in-jsx-scope': 'off', // 不再需要在 JSX 文件中导入 React

      // Import 规则
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ], // 强制导入顺序

      // Prettier 规则
      'prettier/prettier': ['error', {}, { usePrettierrc: true }], // 使用 .prettierrc 文件中的配置
    },
  },
)
