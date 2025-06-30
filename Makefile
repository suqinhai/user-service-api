# Express API 项目管理 Makefile

# 变量定义
PROJECT_NAME = express-api
DOCKER_COMPOSE = docker-compose
DOCKER_COMPOSE_DEV = docker-compose -f docker-compose.dev.yml
NODE_VERSION = 18

# 默认目标
.DEFAULT_GOAL := help

# 帮助信息
.PHONY: help
help: ## 显示帮助信息
	@echo "Express API 项目管理命令:"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# 开发环境命令
.PHONY: dev
dev: ## 启动开发环境
	npm run dev

.PHONY: dev-docker
dev-docker: ## 使用Docker启动开发环境
	$(DOCKER_COMPOSE_DEV) up --build

.PHONY: dev-docker-bg
dev-docker-bg: ## 后台运行Docker开发环境
	$(DOCKER_COMPOSE_DEV) up -d --build

.PHONY: dev-stop
dev-stop: ## 停止Docker开发环境
	$(DOCKER_COMPOSE_DEV) down

.PHONY: dev-logs
dev-logs: ## 查看开发环境日志
	$(DOCKER_COMPOSE_DEV) logs -f

# 生产环境命令
.PHONY: prod
prod: ## 启动生产环境
	$(DOCKER_COMPOSE) up --build

.PHONY: prod-bg
prod-bg: ## 后台运行生产环境
	$(DOCKER_COMPOSE) up -d --build

.PHONY: prod-stop
prod-stop: ## 停止生产环境
	$(DOCKER_COMPOSE) down

.PHONY: prod-logs
prod-logs: ## 查看生产环境日志
	$(DOCKER_COMPOSE) logs -f

# 依赖管理
.PHONY: install
install: ## 安装依赖
	npm install

.PHONY: install-clean
install-clean: ## 清理并重新安装依赖
	rm -rf node_modules package-lock.json
	npm install

.PHONY: update
update: ## 更新依赖
	npm update





# 数据库
.PHONY: db-sync
db-sync: ## 同步数据库结构
	npm run db:sync

.PHONY: db-reset
db-reset: ## 重置数据库
	$(DOCKER_COMPOSE_DEV) exec mysql mysql -u root -prootpassword -e "DROP DATABASE IF EXISTS express_api_dev; CREATE DATABASE express_api_dev;"

# 清理
.PHONY: clean
clean: ## 清理临时文件
	rm -rf logs/*.log
	rm -rf coverage/
	rm -rf node_modules/.cache/

.PHONY: clean-docker
clean-docker: ## 清理Docker资源
	docker system prune -f
	docker volume prune -f

.PHONY: clean-all
clean-all: clean clean-docker ## 清理所有临时文件和Docker资源

# 构建
.PHONY: build
build: ## 构建Docker镜像
	docker build -t $(PROJECT_NAME):latest .

.PHONY: build-dev
build-dev: ## 构建开发Docker镜像
	docker build --target development -t $(PROJECT_NAME):dev .

# 健康检查
.PHONY: health
health: ## 检查应用健康状态
	curl -f http://localhost:3000/health || echo "应用未运行或健康检查失败"

# 日志
.PHONY: logs-tail
logs-tail: ## 实时查看应用日志
	tail -f logs/*.log

.PHONY: logs-clean
logs-clean: ## 清理日志文件
	rm -f logs/*.log

# 工具
.PHONY: tools-up
tools-up: ## 启动开发工具 (phpMyAdmin, Redis Commander等)
	$(DOCKER_COMPOSE_DEV) --profile with-tools up -d

.PHONY: tools-down
tools-down: ## 停止开发工具
	$(DOCKER_COMPOSE_DEV) --profile with-tools down

# 安全检查
.PHONY: audit
audit: ## 运行安全审计
	npm audit

.PHONY: audit-fix
audit-fix: ## 自动修复安全问题
	npm audit fix

# 性能测试
.PHONY: perf-test
perf-test: ## 运行性能测试 (需要安装artillery)
	@if command -v artillery >/dev/null 2>&1; then \
		artillery quick --count 10 --num 100 http://localhost:3000/health; \
	else \
		echo "请先安装artillery: npm install -g artillery"; \
	fi

# 备份
.PHONY: backup-db
backup-db: ## 备份数据库
	$(DOCKER_COMPOSE) exec mysql mysqldump -u root -prootpassword express_api > backup_$(shell date +%Y%m%d_%H%M%S).sql

# 监控
.PHONY: monitor
monitor: ## 显示系统资源使用情况
	@echo "=== Docker 容器状态 ==="
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "=== 系统资源使用 ==="
	docker stats --no-stream

# 快速启动命令
.PHONY: quick-start
quick-start: install dev-docker-bg ## 快速启动开发环境

.PHONY: quick-stop
quick-stop: dev-stop clean ## 快速停止并清理
