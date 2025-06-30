/**
 * 通用API中间件栈
 * 为通用接口提供基础的限流、缓存和监控功能
 */

const { baseAuth } = require('../core/auth');
const { generalRateLimit, createCustomRateLimit } = require('../core/rateLimit');
const { staticDataCache, createCacheMiddleware } = require('../core/cache');
const { generalApiType, createAutoApiTypeMiddleware } = require('../utils/apiType');
const { basicAudit } = require('../monitoring/audit');
const { performanceMonitor } = require('../monitoring/performance');
const { commonValidations } = require('../core/validator');
const { logger } = require('../../common/logger');
const { createMiddlewareChain, conditionalMiddleware } = require('../utils/helpers');

/**
 * 通用认证中间件配置
 */
const commonAuth = {
  /**
   * 可选认证（有token则验证，无token则跳过）
   */
  optional: baseAuth,
  
  /**
   * 条件认证（根据条件决定是否需要认证）
   * @param {Function} condition - 条件函数
   * @returns {Function} 条件认证中间件
   */
  conditional: (condition) => {
    return conditionalMiddleware(condition, baseAuth);
  }
};

/**
 * 通用限流配置
 */
const commonLimiting = {
  /**
   * 标准通用限流
   */
  standard: generalRateLimit,
  
  /**
   * 宽松限流（用于静态资源等）
   */
  relaxed: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5000, // 每15分钟5000次请求
    type: 'general_relaxed'
  }),
  
  /**
   * 严格限流（用于公开但敏感的接口）
   */
  strict: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 500, // 每15分钟500次请求
    type: 'general_strict'
  }),
  
  /**
   * API文档限流
   */
  docs: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000, // 每15分钟1000次请求
    type: 'api_docs'
  }),
  
  /**
   * 健康检查限流（非常宽松）
   */
  health: createCustomRateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 100, // 每分钟100次请求
    type: 'health_check'
  })
};

/**
 * 通用缓存配置
 */
const commonCaching = {
  /**
   * 静态数据缓存
   */
  static: staticDataCache,
  
  /**
   * 短期缓存（1分钟）
   */
  short: createCacheMiddleware({
    ttl: 60,
    prefix: 'common_short',
    includeUser: false
  }),
  
  /**
   * 中期缓存（5分钟）
   */
  medium: createCacheMiddleware({
    ttl: 300,
    prefix: 'common_medium',
    includeUser: false
  }),
  
  /**
   * 长期缓存（1小时）
   */
  long: createCacheMiddleware({
    ttl: 3600,
    prefix: 'common_long',
    includeUser: false
  }),
  
  /**
   * API文档缓存
   */
  docs: createCacheMiddleware({
    ttl: 1800, // 30分钟
    prefix: 'api_docs',
    includeUser: false
  })
};

/**
 * 通用基础中间件栈
 * 最基本的通用中间件
 */
const baseStack = createMiddlewareChain()
  .use(generalApiType)        // API类型标识
  .use(commonLimiting.standard) // 标准限流
  .use(performanceMonitor)    // 性能监控
  .use(basicAudit)           // 基础审计
  .build();

/**
 * 通用公开接口中间件栈
 * 完全公开的接口，不需要任何认证
 */
const publicStack = createMiddlewareChain()
  .use(generalApiType)
  .use(commonLimiting.relaxed)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 通用可选认证中间件栈
 * 可选认证的接口
 */
const optionalAuthStack = createMiddlewareChain()
  .use(generalApiType)
  .use(commonLimiting.standard)
  .use(commonAuth.optional)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 通用缓存接口中间件栈
 * 带缓存的公开接口
 */
const cachedStack = createMiddlewareChain()
  .use(generalApiType)
  .use(commonLimiting.standard)
  .use(commonCaching.medium)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 通用静态资源中间件栈
 * 用于静态资源或长期缓存的内容
 */
const staticStack = createMiddlewareChain()
  .use(generalApiType)
  .use(commonLimiting.relaxed)
  .use(commonCaching.static)
  .use(performanceMonitor)
  .build();

/**
 * API文档中间件栈
 * 专门用于API文档接口
 */
const docsStack = createMiddlewareChain()
  .use(generalApiType)
  .use(commonLimiting.docs)
  .use(commonCaching.docs)
  .use(performanceMonitor)
  .build();

/**
 * 健康检查中间件栈
 * 用于健康检查和监控接口
 */
const healthStack = createMiddlewareChain()
  .use(generalApiType)
  .use(commonLimiting.health)
  .use(performanceMonitor)
  .build();

/**
 * 自动API类型检测中间件栈
 * 根据路径自动检测API类型
 */
const autoTypeStack = createMiddlewareChain()
  .use(createAutoApiTypeMiddleware())
  .use(commonLimiting.standard)
  .use(commonAuth.optional)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 创建条件认证中间件栈
 * @param {Function} condition - 认证条件函数
 * @param {Object} options - 选项配置
 * @returns {Array} 中间件数组
 */
function createConditionalAuthStack(condition, options = {}) {
  const {
    limiting = 'standard',
    caching = false,
    performance = true,
    audit = true
  } = options;
  
  const chain = createMiddlewareChain()
    .use(generalApiType)
    .use(commonLimiting[limiting] || commonLimiting.standard)
    .use(commonAuth.conditional(condition));
  
  if (caching) {
    const cacheMiddleware = typeof caching === 'string' 
      ? commonCaching[caching] 
      : createCacheMiddleware(caching);
    chain.use(cacheMiddleware);
  }
  
  if (performance) {
    chain.use(performanceMonitor);
  }
  
  if (audit) {
    chain.use(basicAudit);
  }
  
  return chain.toArray();
}

/**
 * 创建自定义通用中间件栈
 * @param {Object} config - 配置选项
 * @returns {Array} 中间件数组
 */
function createCustomCommonStack(config = {}) {
  const {
    apiType = 'general',      // 'general', 'auto'
    auth = 'none',           // 'none', 'optional', 'conditional'
    authCondition = null,    // 条件认证的条件函数
    limiting = 'standard',   // 'relaxed', 'standard', 'strict', 'docs', 'health'
    caching = false,        // false, 'short', 'medium', 'long', 'static', 'docs'
    performance = true,
    audit = true,
    validation = null       // 验证中间件
  } = config;
  
  const chain = createMiddlewareChain();
  
  // 添加API类型标识
  if (apiType === 'auto') {
    chain.use(createAutoApiTypeMiddleware());
  } else {
    chain.use(generalApiType);
  }
  
  // 添加限流
  chain.use(commonLimiting[limiting] || commonLimiting.standard);
  
  // 添加认证
  switch (auth) {
    case 'optional':
      chain.use(commonAuth.optional);
      break;
    case 'conditional':
      if (authCondition) {
        chain.use(commonAuth.conditional(authCondition));
      }
      break;
    // 'none' 不添加认证中间件
  }
  
  // 添加验证
  if (validation) {
    if (typeof validation === 'string' && commonValidations[validation]) {
      chain.use(commonValidations[validation]);
    } else if (Array.isArray(validation)) {
      validation.forEach(v => chain.use(v));
    } else if (typeof validation === 'function') {
      chain.use(validation);
    }
  }
  
  // 添加缓存
  if (caching) {
    const cacheMiddleware = typeof caching === 'string' 
      ? commonCaching[caching] 
      : createCacheMiddleware(caching);
    if (cacheMiddleware) {
      chain.use(cacheMiddleware);
    }
  }
  
  // 添加性能监控
  if (performance) {
    chain.use(performanceMonitor);
  }
  
  // 添加审计
  if (audit) {
    chain.use(basicAudit);
  }
  
  return chain.toArray();
}

/**
 * 通用中间件工具函数
 */
const commonUtils = {
  /**
   * 创建CORS中间件（如果需要）
   */
  createCORS: (options = {}) => {
    return (req, res, next) => {
      const {
        origin = '*',
        methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders = 'Content-Type,Authorization',
        credentials = false
      } = options;
      
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', methods);
      res.header('Access-Control-Allow-Headers', allowedHeaders);
      
      if (credentials) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      next();
    };
  },
  
  /**
   * 创建请求日志中间件
   */
  createRequestLogger: (options = {}) => {
    const { logLevel = 'info', includeBody = false } = options;
    
    return (req, res, next) => {
      const logData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };
      
      if (includeBody && req.body) {
        logData.body = req.body;
      }
      
      logger[logLevel]('请求日志', logData);
      next();
    };
  }
};

/**
 * 通用中间件栈集合
 */
const commonMiddleware = {
  // 预定义栈
  base: baseStack,
  public: publicStack,
  optionalAuth: optionalAuthStack,
  cached: cachedStack,
  static: staticStack,
  docs: docsStack,
  health: healthStack,
  autoType: autoTypeStack,
  
  // 工厂函数
  conditionalAuth: createConditionalAuthStack,
  custom: createCustomCommonStack,
  
  // 组件
  auth: commonAuth,
  limiting: commonLimiting,
  caching: commonCaching,
  utils: commonUtils
};

module.exports = commonMiddleware;
