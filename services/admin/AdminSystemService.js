/**
 * 管理员系统服务
 * 处理管理端系统管理相关业务逻辑
 */

const BaseService = require('../base/BaseService');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class AdminSystemService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取系统信息
   * @returns {Promise<Object>} 系统信息
   */
  async getSystemInfo() {
    try {
      this.logAction('获取系统信息');

      const systemInfo = {
        server: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: os.uptime(),
          nodeVersion: process.version,
          pid: process.pid
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Unknown',
          loadAverage: os.loadavg()
        },
        process: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          env: process.env.NODE_ENV
        }
      };

      this.logAction('获取系统信息成功');
      return systemInfo;

    } catch (error) {
      this.logError('获取系统信息失败', error);
      throw error;
    }
  }

  /**
   * 获取应用健康状态
   * @param {Object} sequelize - 数据库实例
   * @param {Object} mongodb - MongoDB实例
   * @returns {Promise<Object>} 健康状态
   */
  async getHealthStatus(sequelize, mongodb) {
    try {
      this.logAction('获取应用健康状态');

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {}
      };

      // 检查数据库连接
      try {
        await sequelize.authenticate();
        health.services.mysql = {
          status: 'healthy',
          message: 'MySQL连接正常'
        };
      } catch (error) {
        health.services.mysql = {
          status: 'unhealthy',
          message: 'MySQL连接失败',
          error: error.message
        };
        health.status = 'unhealthy';
      }

      // 检查MongoDB连接
      if (mongodb && mongodb.mongoHealthCheck) {
        try {
          const mongoHealth = await mongodb.mongoHealthCheck();
          health.services.mongodb = mongoHealth;
          
          if (mongoHealth.status !== 'healthy') {
            health.status = 'unhealthy';
          }
        } catch (error) {
          health.services.mongodb = {
            status: 'error',
            message: 'MongoDB健康检查失败',
            error: error.message
          };
          health.status = 'unhealthy';
        }
      } else {
        health.services.mongodb = {
          status: 'not_configured',
          message: 'MongoDB未配置'
        };
      }

      // 检查Redis连接
      try {
        await this.cache.redis.ping();
        health.services.redis = {
          status: 'healthy',
          message: 'Redis连接正常'
        };
      } catch (error) {
        health.services.redis = {
          status: 'unhealthy',
          message: 'Redis连接失败',
          error: error.message
        };
        health.status = 'unhealthy';
      }

      this.logAction('获取应用健康状态成功', { status: health.status });
      return health;

    } catch (error) {
      this.logError('获取应用健康状态失败', error);
      throw error;
    }
  }

  /**
   * 清除系统缓存
   * @param {Array} cacheTypes - 缓存类型列表
   * @returns {Promise<Object>} 清除结果
   */
  async clearSystemCache(cacheTypes = []) {
    try {
      this.logAction('清除系统缓存', { cacheTypes });

      const results = {};
      const defaultTypes = ['user', 'config', 'stats', 'token'];
      const typesToClear = cacheTypes.length > 0 ? cacheTypes : defaultTypes;

      for (const type of typesToClear) {
        try {
          // 获取该类型的所有缓存键
          const pattern = `${type}:*`;
          const keys = await this.cache.redis.keys(pattern);
          
          if (keys.length > 0) {
            await this.cache.redis.del(...keys);
            results[type] = {
              success: true,
              cleared: keys.length,
              message: `清除了 ${keys.length} 个缓存项`
            };
          } else {
            results[type] = {
              success: true,
              cleared: 0,
              message: '没有找到相关缓存项'
            };
          }
        } catch (error) {
          results[type] = {
            success: false,
            error: error.message
          };
        }
      }

      this.logAction('清除系统缓存完成', { results });
      return results;

    } catch (error) {
      this.logError('清除系统缓存失败', error);
      throw error;
    }
  }

  /**
   * 获取系统日志
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 日志数据
   */
  async getSystemLogs(options = {}) {
    try {
      this.logAction('获取系统日志', options);

      const {
        level = 'all',
        limit = 100,
        offset = 0,
        startDate,
        endDate
      } = options;

      // 这里应该根据实际的日志存储方式来实现
      // 示例：从文件系统读取日志
      const logDir = path.join(process.cwd(), 'logs');
      const logFiles = await fs.readdir(logDir);
      
      // 过滤今天的日志文件
      const today = new Date().toISOString().split('T')[0];
      const todayLogFiles = logFiles.filter(file => file.includes(today));

      const logs = [];
      
      for (const file of todayLogFiles.slice(0, 5)) { // 限制读取文件数量
        try {
          const filePath = path.join(logDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          
          lines.forEach(line => {
            try {
              const logEntry = JSON.parse(line);
              
              // 过滤日志级别
              if (level !== 'all' && logEntry.level !== level) {
                return;
              }
              
              // 过滤日期范围
              if (startDate && new Date(logEntry.timestamp) < new Date(startDate)) {
                return;
              }
              
              if (endDate && new Date(logEntry.timestamp) > new Date(endDate)) {
                return;
              }
              
              logs.push(logEntry);
            } catch (parseError) {
              // 忽略无法解析的日志行
            }
          });
        } catch (fileError) {
          this.logError('读取日志文件失败', fileError, { file });
        }
      }

      // 按时间倒序排列
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // 分页
      const paginatedLogs = logs.slice(offset, offset + limit);

      this.logAction('获取系统日志成功', { total: logs.length, returned: paginatedLogs.length });

      return {
        logs: paginatedLogs,
        pagination: {
          total: logs.length,
          limit,
          offset,
          hasMore: offset + limit < logs.length
        }
      };

    } catch (error) {
      this.logError('获取系统日志失败', error);
      throw error;
    }
  }

  /**
   * 获取系统配置
   * @returns {Promise<Object>} 系统配置
   */
  async getSystemConfig() {
    try {
      this.logAction('获取系统配置');

      const config = {
        environment: process.env.NODE_ENV,
        port: process.env.PORT,
        database: {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          name: process.env.DB_NAME,
          poolMax: process.env.DB_POOL_MAX,
          poolMin: process.env.DB_POOL_MIN
        },
        redis: {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT,
          db: process.env.REDIS_DB
        },
        mongodb: {
          host: process.env.MONGO_HOST,
          port: process.env.MONGO_PORT,
          dbName: process.env.MONGO_DB_NAME
        },
        jwt: {
          expiresIn: process.env.JWT_EXPIRES_IN
        },
        cache: {
          ttlShort: process.env.CACHE_TTL_SHORT,
          ttlMedium: process.env.CACHE_TTL_MEDIUM,
          ttlLong: process.env.CACHE_TTL_LONG
        }
      };

      this.logAction('获取系统配置成功');
      return config;

    } catch (error) {
      this.logError('获取系统配置失败', error);
      throw error;
    }
  }

  /**
   * 更新系统配置
   * @param {Object} configData - 配置数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateSystemConfig(configData) {
    try {
      this.logAction('更新系统配置', { keys: Object.keys(configData) });

      // 验证配置数据
      const validation = this.validateConfigData(configData);
      if (!validation.isValid) {
        throw new Error('配置数据验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      // 这里应该实现配置更新逻辑
      // 例如：更新环境变量文件、重启服务等
      
      // 示例：更新缓存中的配置
      await this.cache.set('config', 'system', configData, 3600);

      this.logAction('更新系统配置成功');
      
      return {
        success: true,
        message: '系统配置更新成功',
        updatedAt: new Date()
      };

    } catch (error) {
      this.logError('更新系统配置失败', error);
      throw error;
    }
  }

  /**
   * 验证配置数据
   * @param {Object} configData - 配置数据
   * @returns {Object} 验证结果
   */
  validateConfigData(configData) {
    const rules = {
      'cache.ttlShort': {
        type: 'number',
        min: 60,
        max: 3600
      },
      'cache.ttlMedium': {
        type: 'number',
        min: 300,
        max: 86400
      },
      'cache.ttlLong': {
        type: 'number',
        min: 3600,
        max: 604800
      }
    };

    // 扁平化配置对象进行验证
    const flatConfig = this.flattenObject(configData);
    
    return this.validateData(flatConfig, rules);
  }

  /**
   * 扁平化对象
   * @param {Object} obj - 对象
   * @param {string} prefix - 前缀
   * @returns {Object} 扁平化后的对象
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    });
    
    return flattened;
  }

  /**
   * 获取系统统计信息
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 统计信息
   */
  async getSystemStatistics(sequelize) {
    try {
      this.logAction('获取系统统计信息');

      const User = sequelize.models.User;
      
      const stats = {
        users: {
          total: await User.count(),
          active: await User.count({ where: { status: 'active' } }),
          todayRegistrations: await User.count({
            where: {
              created_at: {
                [sequelize.Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          })
        },
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        timestamp: new Date()
      };

      this.logAction('获取系统统计信息成功');
      return stats;

    } catch (error) {
      this.logError('获取系统统计信息失败', error);
      throw error;
    }
  }
}

module.exports = AdminSystemService;
