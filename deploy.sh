#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  MultiChat 一键部署脚本
#  用法: chmod +x deploy.sh && ./deploy.sh
# ═══════════════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔═════════════════════════════════════════╗"
echo "  ║     MultiChat - 一键部署               ║"
echo "  ║     多模型聚合聊天平台                  ║"
echo "  ╚═════════════════════════════════════════╝"
echo -e "${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker 未安装，正在安装...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker 安装完成${NC}"
fi

# 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}Docker Compose 未安装，正在安装...${NC}"
        apt-get update && apt-get install -y docker-compose-plugin 2>/dev/null || {
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        }
    fi
fi

# 生成随机 JWT_SECRET（仅首次）
if [ ! -f .jwt_secret ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    echo "$JWT_SECRET" > .jwt_secret
    echo -e "${GREEN}已生成 JWT 密钥${NC}"
else
    JWT_SECRET=$(cat .jwt_secret)
fi

# 导出环境变量
export JWT_SECRET="$JWT_SECRET"

# 构建并启动
echo -e "${CYAN}正在构建镜像...${NC}"
docker compose build --quiet

echo -e "${CYAN}正在启动服务...${NC}"
docker compose up -d

# 等待健康检查
echo -e "${CYAN}等待服务就绪...${NC}"
for i in $(seq 1 30); do
    if curl -sf http://localhost:${PORT:-3000}/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

PORT=${PORT:-3000}
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}  访问地址: http://localhost:${PORT}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "常用命令:"
echo "  查看日志:   docker compose logs -f"
echo "  停止服务:   docker compose down"
echo "  重启服务:   docker compose restart"
echo "  查看状态:   docker compose ps"
