import { defineConfig } from 'vite';

// MultiChat 前端构建配置。
// root 默认为本文件所在目录（frontend/），index.html 即入口。
// 构建产物输出到 frontend/dist，与后端 server.ts 的静态服务目录一致。

// 独立静态托管 frontend/dist 时没有 Express 响应的安全头，因此构建阶段
// 注入一条等价的 CSP meta 作为兜底。必须与 backend/server.ts 的 CSP_POLICY
// 保持一致（HTTP 头额外多一条 frame-ancestors，meta 中该指令无效故省略）。
const CSP_POLICY =
  "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*; " +
  "form-action 'self'";

const cspMeta = {
  name: 'multichat-csp-meta',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    if (html.includes('http-equiv="Content-Security-Policy"')) return html;
    return html.replace(
      '</head>',
      `    <meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}" />\n  </head>`
    );
  },
};

export default defineConfig({
  base: '/',
  plugins: [cspMeta],
  build: {
    outDir: 'dist',
    // 清理旧的内容哈希文件，确保 CLI/npm 包只携带当前版本的静态资源。
    emptyOutDir: true,
  },
});
