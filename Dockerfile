# ── Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 安装后端依赖
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine

# 安装 dumb-init 防止僵尸进程
RUN apk add --no-cache dumb-init

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

# 从 builder 复制 node_modules
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

# 使用 dumb-init 作为 PID 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
