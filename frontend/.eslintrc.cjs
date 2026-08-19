module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  ignorePatterns: ['dist', 'node_modules', 'vite.config.js'],
  rules: {
    // E1-3 采用 globalThis 挂接模式：业务函数经 src/main.js 聚合层统一挂到全局，
    // 模块间调用走全局而非显式 import（彻底消除拆分遗漏 ReferenceError 的风险）。
    // 因此关闭 no-undef —— 这是既定设计，不是未定义变量遗漏。
    'no-undef': 'off',
    'no-unused-vars': 'warn',
    'no-console': 'warn',
    'eqeqeq': 'warn',
    'prefer-const': 'warn',
    'no-empty': 'off',
    // SSE 流式读取使用 while(true) 循环（行业标准写法），仅关闭循环检查，
    // 保留对 if/for 中常量条件（真 bug）的告警。
    'no-constant-condition': ['warn', { checkLoops: false }],
  },
};
