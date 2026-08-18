import { defineConfig } from 'vite';

// MultiChat 前端构建配置。
// root 默认为本文件所在目录（frontend/），index.html 即入口。
// 构建产物输出到 frontend/dist，与后端 server.js 的静态服务目录一致。
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    // 注意：WorkBuddy 沙箱把 fs.rmSync 包装为「安全删除」（genie-trash），
    // 在隔离环境会 ETIMEDOUT，导致 vite 默认的 emptyOutDir 清空失败。
    // 关闭后由 build 直接覆盖同名产物；dist 目录仅保留构建产出即可。
    emptyOutDir: false,
  },
});
