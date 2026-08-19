# ── Build & Prod deps ───────────────────────────────────────────────
# 后端以 tsx 运行时启动（server.js 经 tsx 解析 lib/ 下的 .ts 模块），
# 因此 tsx 是运行时依赖，必须随生产镜像提供；基础镜像改用 glibc 系
# node:20-slim，避免 Alpine(musl) 与 esbuild/tsx 的 glibc 二进制不兼容。
FROM node:20-slim AS builder

WORKDIR /app

# 全量安装：tsx 位于 devDependencies，但运行时需它解析 .ts，故不省略 dev
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# ── Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# 复制后端运行时文件
COPY backend/package.json ./
COPY backend/server.js ./
COPY backend/prompts.json ./
COPY backend/mcp.js ./
COPY backend/adapters/ ./adapters/
COPY backend/lib/ ./lib/
COPY backend/runtime/ ./runtime/
COPY backend/routes/ ./routes/
COPY backend/plugins/ ./plugins/
COPY backend/marketplace/ ./marketplace/

# 从 builder 复制生产 node_modules（含 tsx 运行时）
COPY --from=builder /app/node_modules ./node_modules

# 复制前端静态文件
COPY frontend/dist ./frontend/dist

# 数据持久化目录
RUN mkdir -p /app/data

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV FRONTEND_DIST=/app/frontend/dist
ENV MULTICHAT_ALLOW_REMOTE_MCP=0

# 后端以 tsx 运行时启动：node --import tsx 注册 TypeScript 加载器，
# 使 server.js 中 require('./lib/context') 等能正确解析 .ts 模块。
CMD ["node", "--import", "tsx", "server.js"]
