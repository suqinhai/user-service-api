/**
 * 健康检查模块
 * 提供API服务各组件的健康状态检查
 */
const os = require('os');
const { logger } = require('./logger');
const sequelize = require('./mysql');
const { redis: redisClient } = require('./redis');
const { mongoHealthCheck } = require('./mango');

/**
 * 健康检查类
 */
class HealthCheck {
  /**
   * 执行完整的健康检查
   * @returns {Promise<Object>} 健康检查结果
   */
  async checkAll() {
    try {
      const [dbStatus, mongoStatus, cacheStatus, systemStatus] = await Promise.all([
        this.checkDatabase(),
        this.checkMongoDB(),
        this.checkCache(),
        this.checkSystem()
      ]);

      // 综合状态评估
      const isHealthy =
        dbStatus.status === 'ok' &&
        mongoStatus.status === 'ok' &&
        cacheStatus.status === 'ok' &&
        systemStatus.status === 'ok';

      return {
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components: {
          database: dbStatus,
          mongodb: mongoStatus,
          cache: cacheStatus,
          system: systemStatus
        },
        version: process.env.npm_package_version || '1.0.0'
      };
    } catch (error) {
      logger.error('健康检查执行失败', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 检查数据库连接状态
   * @returns {Promise<Object>} 数据库健康状态
   */
  async checkDatabase() {
    try {
      // 检查sequelize实例是否存在
      if (!sequelize) {
        return {
          status: 'error',
          error: 'Sequelize实例未初始化',
          details: {
            dialect: 'unknown',
            connection: 'inactive'
          }
        };
      }

      // 尝试进行简单查询验证连接
      const startTime = Date.now();
      await sequelize.authenticate();
      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        responseTime: `${responseTime}ms`,
        details: {
          dialect: sequelize.getDialect(),
          connection: 'active'
        }
      };
    } catch (error) {
      logger.error('数据库健康检查失败', error);
      return {
        status: 'error',
        error: error.message,
        details: {
          dialect: sequelize?.getDialect() || 'unknown',
          connection: 'inactive'
        }
      };
    }
  }

  /**
   * 检查MongoDB连接状态
   * @returns {Promise<Object>} MongoDB健康状态
   */
  async checkMongoDB() {
    try {
      const mongoStatus = await mongoHealthCheck();

      if (mongoStatus.status === 'healthy') {
        return {
          status: 'ok',
          details: {
            connection: 'active',
            database: mongoStatus.database,
            state: mongoStatus.state
          }
        };
      } else if (mongoStatus.status === 'disconnected') {
        return {
          status: 'not_configured',
          details: {
            connection: 'inactive',
            message: 'MongoDB未连接'
          }
        };
      } else {
        return {
          status: 'error',
          error: mongoStatus.message,
          details: {
            connection: 'inactive',
            state: mongoStatus.state || 'unknown'
          }
        };
      }
    } catch (error) {
      logger.error('MongoDB健康检查失败', error);
      return {
        status: 'error',
        error: error.message,
        details: {
          connection: 'inactive'
        }
      };
    }
  }

  /**
   * 检查缓存服务状态
   * @returns {Promise<Object>} 缓存服务健康状态
   */
  async checkCache() {
    try {
      if (!redisClient) {
        return {
          status: 'not_configured',
          details: {
            connection: 'inactive',
            message: 'Redis客户端未配置'
          }
        };
      }

      // 检查Redis连接状态
      if (redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
        return {
          status: 'error',
          error: `Redis连接状态异常: ${redisClient.status}`,
          details: {
            connection: 'inactive',
            status: redisClient.status
          }
        };
      }

      // 检查Redis连接
      const startTime = Date.now();
      await redisClient.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        responseTime: `${responseTime}ms`,
        details: {
          connection: 'active',
          status: redisClient.status
        }
      };
    } catch (error) {
      logger.error('缓存健康检查失败', error);
      return {
        status: 'error',
        error: error.message,
        details: {
          connection: 'inactive',
          status: redisClient?.status || 'unknown'
        }
      };
    }
  }

  /**
   * 检查系统资源状态
   * @returns {Promise<Object>} 系统资源健康状态
   */
  async checkSystem() {
    try {
      // 获取系统资源使用情况
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;
      
      // 获取CPU负载
      const cpuLoad = os.loadavg();
      
      // 获取进程内存使用情况
      const processMemory = process.memoryUsage();
      
      // 设置阈值警告
      const memoryWarning = memoryUsage > 90;
      const cpuWarning = cpuLoad[0] > os.cpus().length * 0.8;
      
      const status = (memoryWarning || cpuWarning) ? 'warning' : 'ok';
      
      return {
        status,
        details: {
          memory: {
            total: `${Math.round(totalMem / 1024 / 1024)} MB`,
            free: `${Math.round(freeMem / 1024 / 1024)} MB`,
            usage: `${Math.round(memoryUsage)}%`,
            warning: memoryWarning
          },
          cpu: {
            cores: os.cpus().length,
            load: cpuLoad,
            warning: cpuWarning
          },
          process: {
            rss: `${Math.round(processMemory.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(processMemory.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(processMemory.heapUsed / 1024 / 1024)} MB`
          },
          os: {
            platform: process.platform,
            version: os.release(),
            uptime: Math.floor(os.uptime())
          }
        }
      };
    } catch (error) {
      logger.error('系统资源健康检查失败', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new HealthCheck(); 