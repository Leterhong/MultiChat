# MultiChat — local-first multi-model agent workspace
# 构建：docker build -t multichat .
# 运行：docker run -p 3000:3000 -v multichat-data:/data -v "$PWD:/workspace" ghcr.io/leterhong/multichat
# 说明：/data 存运行数据（SQLite/密钥账本），/workspace 是 Agent 工作区（Skills、项目文件）。
# 用 debian-slim 而非 alpine：rolldown/esbuild 的 musl 原生绑定覆盖不全，glibc 构建更稳。

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix backend ci --no-audit --no-fund \
 && npm --prefix frontend ci --no-audit --no-fund
COPY backend/ ./backend/
COPY frontend/ ./frontend/
RUN npm --prefix backend run build \
 && npm --prefix frontend run build \
 && npm --prefix backend prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prompts.json ./backend/prompts.json
COPY --from=build /app/backend/extensions ./backend/extensions
COPY --from=build /app/frontend/dist ./frontend/dist
COPY bin ./bin
COPY package.json ./package.json
RUN mkdir -p /data /workspace \
 && chown -R node:node /data /workspace /app
VOLUME ["/data", "/workspace"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "bin/multichat.mjs", "web", "--host", "0.0.0.0", "--port", "3000", "--data-dir", "/data", "--workspace", "/workspace", "--no-open"]
