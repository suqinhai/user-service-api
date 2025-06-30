/**
 * 总台API中间件栈
 * 为总台接口提供专门的认证、限流和权限控制
 */

const jwt = require('jsonwebtoken');
const { createRateLimiter } = require('../core/rateLimit');
const { createCacheMiddleware } = require('../core/cache');
const { consoleApiType } = require('../utils/apiType');
const { basicAudit, sensitiveOperationAudit } = require('../monitoring/audit');
const { performanceMonitor } = require('../monitoring/performance');
const { logger } = require('../../common/logger');
const { createMiddlewareChain } = require('../utils/helpers');
const { USER_ROLE } = require('../../common/constants/status');

/**
 * 总台认证中间件
 */
const consoleAuth = {
  /**
   * 总台管理员认证中间件
   * 验证用户是否为总台管理员
   */
  required: async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: 0,
          message: '未提供访问令牌',
          timestamp: new Date().toISOString()
        });
      }

      // 验证JWT令牌
      const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
      const decoded = jwt.verify(token, jwtSecret);

      // 检查令牌类型
      if (decoded.type !== 'access') {
        return res.status(401).json({
          success: 0,
          message: '无效的令牌类型',
          timestamp: new Date().toISOString()
        });
      }

      // 检查是否为总台管理员
      if (decoded.role !== USER_ROLE.CONSOLE_ADMIN) {
        return res.status(403).json({
          success: 0,
          message: '无权限访问总台接口',
          timestamp: new Date().toISOString()
        });
      }

      // 将用户信息添加到请求对象
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        userType: decoded.userType
      };

      req.isAuthenticated = true;
      next();

    } catch (error) {
      logger.error('总台认证中间件错误:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: 0,
          message: '令牌已过期',
          timestamp: new Date().toISOString()
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: 0,
          message: '无效的令牌',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({
          success: 0,
          message: '认证服务异常',
          timestamp: new Date().toISOString()
        });
      }
    }
  },

  /**
   * 可选的总台认证中间件
   * 如果提供了令牌则验证，否则继续
   */
  optional: async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        req.isAuthenticated = false;
        return next();
      }

      // 使用必需认证的逻辑，但不强制要求令牌
      await consoleAuth.required(req, res, next);

    } catch (error) {
      // 可选认证失败时不阻止请求
      req.isAuthenticated = false;
      next();
    }
  }
};

/**
 * 总台限流配置
 */
const consoleLimiting = {
  /**
   * 总台登录限流 - 更严格的限制
   */
  login: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 3, // 每15分钟最多3次登录尝试（比普通登录更严格）
    message: {
      success: 0,
      message: '总台登录尝试过于频繁，请稍后再试',
      error: 'Too many console login attempts'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // 基于IP和用户名的组合键
      const username = req.body?.username || 'unknown';
      return `console_login:${req.ip}:${username}`;
    }
  }, 'console_login'),

  /**
   * 总台标准操作限流
   */
  standard: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每15分钟最多100次请求
    message: {
      success: 0,
      message: '总台操作过于频繁，请稍后再试',
      error: 'Too many console requests'
    }
  }, 'console_standard'),

  /**
   * 总台敏感操作限流
   */
  sensitive: createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5分钟
    max: 10, // 每5分钟最多10次敏感操作
    message: {
      success: 0,
      message: '总台敏感操作过于频繁，请稍后再试',
      error: 'Too many sensitive console operations'
    }
  }, 'console_sensitive')
};

/**
 * 总台审计配置
 */
const consoleAuditing = {
  /**
   * 基础审计
   */
  basic: basicAudit,
  
  /**
   * 总台操作审计
   */
  operation: (req, res, next) => {
    // 记录总台操作
    logger.info('总台操作审计', {
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    next();
  },

  /**
   * 敏感操作审计
   */
  sensitive: (operationType, options = {}) => {
    return sensitiveOperationAudit(operationType, {
      riskLevel: 'critical',
      metadata: { category: 'console', ...options.metadata },
      ...options
    });
  }
};

/**
 * 总台缓存配置
 */
const consoleCaching = {
  /**
   * 短期缓存 - 用于频繁访问的数据
   */
  short: createCacheMiddleware({
    ttl: 60, // 1分钟
    prefix: 'console_short',
    includeUser: true
  }),

  /**
   * 中期缓存 - 用于相对稳定的数据
   */
  medium: createCacheMiddleware({
    ttl: 300, // 5分钟
    prefix: 'console_medium',
    includeUser: true
  })
};

/**
 * 总台中间件栈配置
 */
const stacks = {
  /**
   * 总台登录中间件栈
   */
  login: createMiddlewareChain()
    .use(consoleApiType)
    .use(consoleLimiting.login)
    .use(performanceMonitor)
    .use(consoleAuditing.operation)
    .build(),

  /**
   * 总台认证接口中间件栈
   */
  authenticated: createMiddlewareChain()
    .use(consoleApiType)
    .use(consoleLimiting.standard)
    .use(consoleAuth.required)
    .use(performanceMonitor)
    .use(consoleAuditing.operation)
    .build(),

  /**
   * 总台敏感操作中间件栈
   */
  sensitive: createMiddlewareChain()
    .use(consoleApiType)
    .use(consoleLimiting.sensitive)
    .use(consoleAuth.required)
    .use(consoleAuditing.sensitive('CONSOLE_SENSITIVE_OPERATION'))
    .use(performanceMonitor)
    .build()
};

module.exports = {
  consoleAuth,
  consoleLimiting,
  consoleAuditing,
  consoleCaching,
  stacks
};
