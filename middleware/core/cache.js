/**
 * 核心缓存中间件
 * 提供路由级别的响应缓存机制，减少数据库负载并提高响应速度
 */

const CacheManager = require('../../common/redis/cache');
const { PREFIX, TTL } = require('../../common/redis');
const { CACHE_CONFIG } = require('../config');
const { logger } = require('../../common/logger');
const crypto = require('crypto');

/**
 * 生成缓存键
 * @param {Object} req - Express请求对象
 * @param {string} prefix - 缓存前缀
 * @param {Object} options - 选项
 * @returns {string} - 缓存键
 */
function generateCacheKey(req, prefix, options = {}) {
  const { includeUser = false, includeBody = false, customKey } = options;
  
  // 如果提供了自定义键生成函数
  if (typeof customKey === 'function') {
    return customKey(req);
  }
  
  // 基础键：包含请求方法和路径
  let key = `${req.method}:${req.originalUrl || req.url}`;
  
  // 如果需要，添加用户ID使缓存用户特定化
  if (includeUser && req.user && req.user.id) {
    key = `user:${req.user.id}:${key}`;
  }
  
  // 如果请求体非空且需要包含，将其作为键的一部分
  if (includeBody && req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const bodyHash = crypto
      .createHash('md5')
      .update(JSON.stringify(req.body))
      .digest('hex');
    key = `${key}:${bodyHash}`;
  }
  
  // 添加查询参数（如果存在）
  if (req.query && Object.keys(req.query).length > 0) {
    const queryHash = crypto
      .createHash('md5')
      .update(JSON.stringify(req.query))
      .digest('hex');
    key = `${key}:${queryHash}`;
  }
  
  // 如果提供了前缀，添加前缀
  if (prefix) {
    key = `${prefix}:${key}`;
  }
  
  return key;
}

/**
 * 路由缓存中间件工厂
 * @param {Object} options - 缓存选项
 * @returns {Function} Express中间件函数
 */
function createCacheMiddleware(options = {}) {
  const config = { ...CACHE_CONFIG.DEFAULT, ...options };
  
  return async (req, res, next) => {
    // 检查是否启用缓存
    if (!config.enabled) {
      return next();
    }
    
    // 只缓存GET请求（除非明确指定）
    if (!config.cacheAllMethods && req.method !== 'GET') {
      return next();
    }
    
    try {
      // 生成缓存键
      const cacheKey = generateCacheKey(req, config.prefix, {
        includeUser: config.includeUser,
        includeBody: config.includeBody,
        customKey: config.keyGenerator
      });
      
      // 尝试从缓存获取数据
      const cachedData = await CacheManager.get(config.prefix, cacheKey);
      
      if (cachedData) {
        // 缓存命中
        logger.debug(`缓存命中: ${cacheKey}`);
        
        // 设置缓存相关的响应头
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        // 如果缓存数据包含状态码，使用它
        if (cachedData.statusCode) {
          res.status(cachedData.statusCode);
        }
        
        // 如果缓存数据包含响应头，设置它们
        if (cachedData.headers) {
          Object.entries(cachedData.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
        }
        
        // 返回缓存的响应体
        return res.json(cachedData.body || cachedData);
      }
      
      // 缓存未命中，继续处理请求
      logger.debug(`缓存未命中: ${cacheKey}`);
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
      
      // 拦截响应，缓存结果
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function(data) {
        cacheResponse(cacheKey, data, res, config);
        originalSend.call(this, data);
      };
      
      res.json = function(data) {
        cacheResponse(cacheKey, data, res, config);
        originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('缓存中间件错误:', error);
      // 缓存错误不应该影响正常请求处理
      next();
    }
  };
}

/**
 * 缓存响应数据
 * @param {string} cacheKey - 缓存键
 * @param {*} data - 响应数据
 * @param {Object} res - 响应对象
 * @param {Object} config - 缓存配置
 */
async function cacheResponse(cacheKey, data, res, config) {
  try {
    // 只缓存成功的响应（除非明确配置）
    if (!config.cacheErrors && res.statusCode >= 400) {
      return;
    }
    
    // 准备缓存数据
    const cacheData = {
      body: data,
      statusCode: res.statusCode,
      headers: config.cacheHeaders ? res.getHeaders() : undefined,
      timestamp: Date.now()
    };
    
    // 存储到缓存
    await CacheManager.set(config.prefix, cacheKey, cacheData, config.ttl);
    logger.debug(`响应已缓存: ${cacheKey}, TTL: ${config.ttl}s`);
  } catch (error) {
    logger.error('缓存响应错误:', error);
  }
}

/**
 * 用户数据缓存中间件
 */
const userDataCache = createCacheMiddleware({
  ...CACHE_CONFIG.USER_DATA,
  includeUser: true
});

/**
 * 管理数据缓存中间件
 */
const adminDataCache = createCacheMiddleware({
  ...CACHE_CONFIG.ADMIN_DATA,
  includeUser: true
});

/**
 * 静态数据缓存中间件
 */
const staticDataCache = createCacheMiddleware(CACHE_CONFIG.STATIC_DATA);

/**
 * 清除缓存中间件
 * 用于在数据更新后清除相关缓存
 * @param {Object} options - 清除选项
 * @returns {Function} Express中间件函数
 */
function createCacheClearMiddleware(options = {}) {
  return async (req, res, next) => {
    // 保存原始的响应方法
    const originalSend = res.send;
    const originalJson = res.json;
    
    // 拦截响应，在成功响应后清除缓存
    const clearCacheAfterResponse = async (data) => {
      try {
        // 只在成功响应后清除缓存
        if (res.statusCode < 400) {
          if (options.patterns) {
            // 根据模式清除缓存
            for (const pattern of options.patterns) {
              await CacheManager.deletePattern(pattern);
              logger.debug(`已清除缓存模式: ${pattern}`);
            }
          }
          
          if (options.keys) {
            // 清除指定的缓存键
            for (const key of options.keys) {
              await CacheManager.delete(key);
              logger.debug(`已清除缓存键: ${key}`);
            }
          }
          
          if (options.clearFunction && typeof options.clearFunction === 'function') {
            // 使用自定义清除函数
            await options.clearFunction(req, res, data);
          }
        }
      } catch (error) {
        logger.error('清除缓存错误:', error);
      }
    };
    
    res.send = function(data) {
      clearCacheAfterResponse(data);
      originalSend.call(this, data);
    };
    
    res.json = function(data) {
      clearCacheAfterResponse(data);
      originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * 条件缓存中间件
 * 根据条件决定是否启用缓存
 * @param {Function} condition - 条件函数
 * @param {Object} cacheOptions - 缓存选项
 * @returns {Function} Express中间件函数
 */
function createConditionalCache(condition, cacheOptions = {}) {
  const cacheMiddleware = createCacheMiddleware(cacheOptions);
  
  return (req, res, next) => {
    if (condition(req, res)) {
      return cacheMiddleware(req, res, next);
    }
    next();
  };
}

/**
 * 缓存预热中间件
 * 在应用启动时预热常用的缓存数据
 */
async function warmupCache() {
  try {
    logger.info('开始缓存预热...');
    
    // 这里可以添加预热逻辑
    // 例如：预加载常用的静态数据、配置信息等
    
    logger.info('缓存预热完成');
  } catch (error) {
    logger.error('缓存预热失败:', error);
  }
}

module.exports = {
  createCacheMiddleware,
  createCacheClearMiddleware,
  createConditionalCache,
  userDataCache,
  adminDataCache,
  staticDataCache,
  generateCacheKey,
  warmupCache
};
