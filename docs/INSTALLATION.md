# 📋 安装与配置指南

本文档详细介绍了Express API项目的安装、配置和初始化过程。

## 📋 目录

- [系统要求](#系统要求)
- [环境准备](#环境准备)
- [项目安装](#项目安装)
- [环境配置](#环境配置)
- [数据库配置](#数据库配置)
- [Redis配置](#redis配置)
- [SSL配置](#ssl配置)
- [常见问题](#常见问题)

## 🖥️ 系统要求

### 最低要求
- **操作系统**: Linux, macOS, Windows 10+
- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **内存**: >= 2GB RAM
- **磁盘空间**: >= 1GB 可用空间

### 推荐配置
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / macOS 12+
- **Node.js**: >= 18.0.0 (LTS)
- **npm**: >= 9.0.0
- **内存**: >= 4GB RAM
- **磁盘空间**: >= 5GB 可用空间

### 数据库要求
- **MySQL**: >= 8.0 或 **MariaDB**: >= 10.5
- **Redis**: >= 6.0

## 🔧 环境准备

### 1. 安装Node.js

#### 使用官方安装包
```bash
# 下载并安装Node.js LTS版本
# 访问 https://nodejs.org/ 下载对应平台的安装包
```

#### 使用包管理器 (Ubuntu/Debian)
```bash
# 更新包列表
sudo apt update

# 安装Node.js和npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### 使用包管理器 (CentOS/RHEL)
```bash
# 安装Node.js和npm
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

#### 使用Homebrew (macOS)
```bash
# 安装Homebrew (如果未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装Node.js
brew install node

# 验证安装
node --version
npm --version
```

### 2. 安装MySQL

#### Ubuntu/Debian
```bash
# 更新包列表
sudo apt update

# 安装MySQL服务器
sudo apt install mysql-server

# 启动MySQL服务
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation
```

#### CentOS/RHEL
```bash
# 安装MySQL仓库
sudo yum install mysql-server

# 启动MySQL服务
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 获取临时密码
sudo grep 'temporary password' /var/log/mysqld.log

# 安全配置
sudo mysql_secure_installation
```

#### macOS
```bash
# 使用Homebrew安装
brew install mysql

# 启动MySQL服务
brew services start mysql

# 安全配置
mysql_secure_installation
```

### 3. 安装Redis

#### Ubuntu/Debian
```bash
# 安装Redis
sudo apt install redis-server

# 启动Redis服务
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 测试连接
redis-cli ping
```

#### CentOS/RHEL
```bash
# 安装EPEL仓库
sudo yum install epel-release

# 安装Redis
sudo yum install redis

# 启动Redis服务
sudo systemctl start redis
sudo systemctl enable redis

# 测试连接
redis-cli ping
```

#### macOS
```bash
# 使用Homebrew安装
brew install redis

# 启动Redis服务
brew services start redis

# 测试连接
redis-cli ping
```

## 📦 项目安装

### 1. 克隆项目
```bash
# 克隆项目仓库
git clone <your-repository-url>
cd express-api

# 或者下载压缩包并解压
wget <download-url>
unzip express-api.zip
cd express-api
```

### 2. 安装依赖
```bash
# 安装项目依赖
npm install

# 或者使用yarn
yarn install

# 清理安装（如果遇到问题）
rm -rf node_modules package-lock.json
npm install
```

### 3. 全局工具安装（可选）
```bash
# 安装常用的全局工具
npm install -g nodemon
npm install -g pm2
```

## ⚙️ 环境配置

### 1. 环境变量配置

项目支持多环境配置，配置文件位于 `env/` 目录：

```bash
env/
├── dev.env          # 开发环境
├── development.env  # 开发环境（备用）
└── test.env        # 测试环境
```

#### 创建生产环境配置
```bash
# 复制开发环境配置作为模板
cp env/dev.env env/production.env

# 编辑生产环境配置
nano env/production.env
```

#### 设置环境变量
```bash
# 方法1: 使用.env文件
cp env/dev.env .env

# 方法2: 直接设置环境变量
export NODE_ENV=development
export PORT=3000
export DB_HOST=localhost
```

### 2. 核心配置项说明

#### 应用配置
```bash
# 运行环境 (dev, development, test, production)
NODE_ENV=dev

# 服务端口
PORT=3000

# API基础URL
API_BASE_URL=http://localhost:3000

# 集群模式 (true/false)
CLUSTER_MODE=false
```

#### 数据库配置
```bash
# 数据库类型
DB_DIALECT=mysql

# 数据库连接信息
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=express_api

# 连接池配置
DB_POOL_MAX=20         # 最大连接数
DB_POOL_MIN=5          # 最小连接数
DB_POOL_ACQUIRE=30000  # 获取连接超时时间(毫秒)
DB_POOL_IDLE=10000     # 空闲连接超时时间(毫秒)
DB_POOL_EVICT=1000     # 空闲检查间隔时间(毫秒)
DB_POOL_MAX_USES=7500  # 单个连接最大使用次数
DB_CONNECT_TIMEOUT=60000 # 连接超时时间(毫秒)
DB_RETRY_MAX=3         # 最大重试次数
```

#### Redis配置
```bash
# Redis连接信息
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 缓存TTL配置(秒)
CACHE_TTL_SHORT=300    # 短期缓存 - 5分钟
CACHE_TTL_MEDIUM=3600  # 中期缓存 - 1小时
CACHE_TTL_LONG=86400   # 长期缓存 - 1天
```

#### JWT配置
```bash
# JWT密钥 (生产环境请使用强密钥)
JWT_SECRET=your_super_secret_jwt_key_here

# JWT过期时间
JWT_EXPIRES_IN=1d
```

## 🗄️ 数据库配置

### 1. 创建数据库
```sql
-- 连接到MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE express_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（可选）
CREATE USER 'apiuser'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON express_api.* TO 'apiuser'@'localhost';
FLUSH PRIVILEGES;

-- 退出MySQL
EXIT;
```

### 2. 数据库初始化
```bash
# 同步数据库结构
npm run db:sync

# 或使用Make命令
make db-sync
```

### 3. 数据库连接测试
```bash
# 运行健康检查
npm run health

# 或直接测试连接
node -e "
const { sequelize } = require('./common');
sequelize.authenticate()
  .then(() => console.log('数据库连接成功'))
  .catch(err => console.error('数据库连接失败:', err));
"
```

## 🔴 Redis配置

### 1. Redis配置文件
```bash
# 创建Redis配置目录
mkdir -p config

# 创建Redis配置文件
cat > config/redis.conf << EOF
# Redis配置文件
port 6379
bind 127.0.0.1
protected-mode yes
tcp-backlog 511
timeout 0
tcp-keepalive 300
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile ""
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ./
maxmemory-policy allkeys-lru
EOF
```

### 2. Redis连接测试
```bash
# 测试Redis连接
redis-cli ping

# 或使用Node.js测试
node -e "
const { redis } = require('./common');
redis.ping()
  .then(result => console.log('Redis连接成功:', result))
  .catch(err => console.error('Redis连接失败:', err));
"
```

## 🔒 SSL配置（生产环境）

### 1. 获取SSL证书

#### 使用Let's Encrypt (免费)
```bash
# 安装Certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 证书位置
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

#### 使用自签名证书（开发环境）
```bash
# 创建SSL目录
mkdir -p config/ssl

# 生成私钥
openssl genrsa -out config/ssl/private.key 2048

# 生成证书
openssl req -new -x509 -key config/ssl/private.key -out config/ssl/certificate.crt -days 365
```

### 2. Nginx SSL配置
```nginx
# config/nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/private.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🚀 启动验证

### 1. 启动应用
```bash
# 开发模式
npm run dev

# 生产模式
npm run start:prod

# 使用PM2（推荐生产环境）
pm2 start bin/www --name "express-api"
```

### 2. 验证服务
```bash
# 检查服务状态
curl http://localhost:3000/health

# 访问API文档
curl http://localhost:3000/api-docs

# 检查日志
tail -f logs/app.log
```

## ❓ 常见问题

### Q1: npm install 失败
```bash
# 清理npm缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install

# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com
npm install
```

### Q2: 数据库连接失败
```bash
# 检查MySQL服务状态
sudo systemctl status mysql

# 检查端口是否开放
netstat -tlnp | grep 3306

# 检查防火墙设置
sudo ufw status
```

### Q3: Redis连接失败
```bash
# 检查Redis服务状态
sudo systemctl status redis

# 检查Redis配置
redis-cli config get "*"

# 测试连接
redis-cli ping
```

### Q4: 端口被占用
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用项目脚本
node scripts/kill-port.js 3000
```

### Q5: 权限问题
```bash
# 修改文件权限
chmod -R 755 express-api/

# 修改所有者
sudo chown -R $USER:$USER express-api/

# 创建日志目录
mkdir -p logs
chmod 755 logs
```

## 📞 技术支持

如果您在安装过程中遇到问题：

1. 查看 [常见问题](#常见问题) 部分
2. 检查系统日志: `tail -f logs/error.log`
3. 查看应用日志: `npm run health`
4. 提交Issue: [GitHub Issues](../../issues)
5. 联系技术支持: support@example.com

---

**下一步**: 阅读 [API使用文档](API.md) 了解如何使用API接口。
