/**
 * ESLint 配置（后端 CommonJS，渐进式）
 * 策略：以 eslint:recommended 为基线，将易在遗留代码中产生海量噪音的规则降级为 warn/off，
 *       不阻塞 CI。目标是建立质量基线 + 让新代码受控，而非一次性清零历史告警。
 */
module.exports = {
  root: true,
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  rules: {
    // 降级为 warn，避免一次性阻塞
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-constant-condition': ['warn', { checkLoops: false }],
    // 关闭在遗留代码中普遍的风格/噪音规则
    'no-console': 'off',
    'no-empty': 'off',
    'no-prototype-builtins': 'off',
    'no-case-declarations': 'off',
    'no-async-promise-executor': 'off',
    'no-control-regex': 'off',
    'no-useless-escape': 'off',
    'no-cond-assign': 'off',
    'no-fallthrough': 'off',
    'no-unsafe-optional-chaining': 'off',
    'no-unsafe-negation': 'off',
    'no-return-assign': 'off',
    'no-mixed-operators': 'off',
    'prefer-const': 'off',
    'no-var': 'off',
    'eqeqeq': 'off',
    'no-shadow': 'off',
    'no-label-var': 'off',
    'complexity': 'off',
    'max-len': 'off',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'tests/'],
};
