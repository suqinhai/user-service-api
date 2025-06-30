/**
 * 核心限流中间件
 * 提供统一的限流功能，支持不同类型的限流策略
 */

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_CONFIG } = require('../config');
const { logger } = require('../../common/logger');

/**
 * 创建限流中间件
 * @param {Object} config - 限流配置
 * @param {string} type - 限流类型 (user/admin/general)
 * @returns {Function} Express限流中间件
 */
function createRateLimiter(config, type = 'general') {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    
    // 自定义键生成器
    keyGenerator: (req) => {
      // 根据类型和用户状态生成不同的限流键
      if (req.user && req.user.id) {
        return `${type}:user:${req.user.id}`;
      }
      return `${type}:ip:${req.ip}`;
    },
    
    // 跳过某些请求的限流
    skip: (req) => {
      // 跳过配置中指定的路径
      if (config.skipPaths && config.skipPaths.includes(req.path)) {
        return true;
      }
      
      // 跳过OPTIONS请求
      if (req.method === 'OPTIONS') {
        return true;
      }
      
      return false;
    },
    
    // 自定义处理器
    handler: (req, res) => {
      const userInfo = req.user ? `User=${req.user.id}` : 'anonymous';
      logger.warn(`${type}限流触发: IP=${req.ip}, ${userInfo}, Path=${req.path}`);
      
      // 如果是管理端，记录安全事件
      if (type === 'admin') {
        logger.security(`管理端API限流触发 - 可能的异常访问`, {
          ip: req.ip,
          adminId: req.user?.id,
          path: req.path,
          userAgent: req.get('User-Agent')
        });
      }
      
      res.status(429).json(config.message);
    }
  });
}

/**
 * 用户端限流中间件
 */
const userRateLimit = createRateLimiter(RATE_LIMIT_CONFIG.USER, 'user');

/**
 * 管理端限流中间件
 */
const adminRateLimit = createRateLimiter(RATE_LIMIT_CONFIG.ADMIN, 'admin');

/**
 * 通用限流中间件
 */
const generalRateLimit = createRateLimiter(RATE_LIMIT_CONFIG.GENERAL, 'general');

/**
 * 创建自定义限流中间件
 * @param {Object} options - 限流选项
 * @returns {Function} Express限流中间件
 */
function createCustomRateLimit(options = {}) {
  const defaultConfig = {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 默认限制
    message: {
      success: false,
      message: '请求过于频繁，请稍后再试',
      error: 'Too many requests'
    },
    standardHeaders: true,
    legacyHeaders: false
  };
  
  const config = { ...defaultConfig, ...options };
  return createRateLimiter(config, options.type || 'custom');
}

/**
 * 严格限流中间件（用于敏感操作）
 */
const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每15分钟最多10次请求
  message: {
    success: false,
    message: '敏感操作请求过于频繁，请稍后再试',
    error: 'Too many sensitive operation requests'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipPaths: []
}, 'strict');

/**
 * 登录限流中间件（防止暴力破解）
 */
const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每15分钟最多5次登录尝试
  message: {
    success: false,
    message: '登录尝试过于频繁，请稍后再试',
    error: 'Too many login attempts'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipPaths: []
}, 'login');

/**
 * 基于IP的限流中间件
 * @param {Object} options - 限流选项
 * @returns {Function} Express限流中间件
 */
function createIPRateLimit(options = {}) {
  const config = {
    windowMs: 15 * 60 * 1000,
    max: 1000,
    ...options
  };
  
  return rateLimit({
    ...config,
    keyGenerator: (req) => req.ip, // 强制使用IP作为键
    handler: (req, res) => {
      logger.warn(`IP限流触发: IP=${req.ip}, Path=${req.path}`);
      res.status(429).json({
        success: false,
        message: '该IP请求过于频繁，请稍后再试',
        error: 'Too many requests from this IP'
      });
    }
  });
}

/**
 * 基于用户的限流中间件
 * @param {Object} options - 限流选项
 * @returns {Function} Express限流中间件
 */
function createUserRateLimit(options = {}) {
  const config = {
    windowMs: 15 * 60 * 1000,
    max: 500,
    ...options
  };
  
  return rateLimit({
    ...config,
    keyGenerator: (req) => {
      if (req.user && req.user.id) {
        return `user:${req.user.id}`;
      }
      return req.ip; // 如果没有用户信息，回退到IP
    },
    skip: (req) => {
      // 如果没有用户信息，跳过用户限流
      return !req.user || !req.user.id;
    },
    handler: (req, res) => {
      logger.warn(`用户限流触发: User=${req.user?.id}, Path=${req.path}`);
      res.status(429).json({
        success: false,
        message: '您的请求过于频繁，请稍后再试',
        error: 'Too many requests from this user'
      });
    }
  });
}

/**
 * 动态限流中间件
 * 根据用户角色和接口类型动态调整限流策略
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
const dynamicRateLimit = (req, res, next) => {
  let limiter;
  
  // 根据API类型选择限流器
  if (req.apiType === 'admin') {
    limiter = adminRateLimit;
  } else if (req.apiType === 'user') {
    limiter = userRateLimit;
  } else {
    limiter = generalRateLimit;
  }
  
  // 应用选择的限流器
  limiter(req, res, next);
};

module.exports = {
  userRateLimit,
  adminRateLimit,
  generalRateLimit,
  strictRateLimit,
  loginRateLimit,
  dynamicRateLimit,
  createCustomRateLimit,
  createIPRateLimit,
  createUserRateLimit,
  createRateLimiter
};
