import { defineConfig } from 'vite';

// MultiChat 前端构建配置。
// root 默认为本文件所在目录（frontend/），index.html 即入口。
// 构建产物输出到 frontend/dist，与后端 server.ts 的静态服务目录一致。
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    // 清理旧的内容哈希文件，确保 CLI/npm 包只携带当前版本的静态资源。
    emptyOutDir: true,
  },
});
