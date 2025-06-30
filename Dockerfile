# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# 复制package文件
COPY package*.json ./

# 安装依赖（生产环境）
FROM base AS dependencies
RUN npm ci --only=production && npm cache clean --force

# 开发依赖安装（用于构建）
FROM base AS dev-dependencies
RUN npm ci

# 开发环境
FROM dev-dependencies AS development
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# 生产构建
FROM dependencies AS production

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 复制应用代码
COPY --chown=nextjs:nodejs . .

# 创建必要的目录
RUN mkdir -p logs && chown -R nextjs:nodejs logs

# 切换到非root用户
USER nextjs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 暴露端口
EXPOSE 3001

# 启动应用
CMD ["npm", "run", "start:prod"]

# 多阶段构建标签
LABEL maintainer="your-email@example.com"
LABEL version="1.0.0"
LABEL description="Express API Application"
