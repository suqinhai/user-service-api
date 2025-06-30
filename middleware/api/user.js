/**
 * 用户端API中间件栈
 * 为用户端接口提供专门的认证、限流和权限控制
 */

const { baseAuth, requireAuth, requirePermissions } = require('../core/auth');
const { userRateLimit, createUserRateLimit } = require('../core/rateLimit');
const { userDataCache, createCacheMiddleware } = require('../core/cache');
const { userApiType } = require('../utils/apiType');
const { basicAudit, userDataAudit } = require('../monitoring/audit');
const { performanceMonitor } = require('../monitoring/performance');
const { logger } = require('../../common/logger');
const { createMiddlewareChain } = require('../utils/helpers');

/**
 * 用户端认证中间件配置
 */
const userAuth = {
  /**
   * 必须认证的中间件
   */
  required: requireAuth,
  
  /**
   * 可选认证的中间件
   * 如果提供了token则验证，没有提供则跳过
   */
  optional: baseAuth,
  
  /**
   * 带权限检查的认证中间件
   * @param {Array|string} permissions - 需要的权限
   * @param {Object} options - 选项配置
   * @returns {Function} 中间件函数
   */
  withPermissions: (permissions, options = {}) => {
    return requirePermissions(permissions, { ...options, requireAuth: true });
  }
};

/**
 * 用户端限流配置
 */
const userLimiting = {
  /**
   * 标准用户限流
   */
  standard: userRateLimit,
  
  /**
   * 宽松限流（用于不敏感的操作）
   */
  relaxed: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 2000 // 每15分钟2000次请求
  }),
  
  /**
   * 严格限流（用于敏感操作）
   */
  strict: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 每15分钟100次请求
  }),
  
  /**
   * 登录限流
   */
  login: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10 // 每15分钟10次登录尝试
  })
};

/**
 * 用户端缓存配置
 */
const userCaching = {
  /**
   * 用户数据缓存
   */
  userData: userDataCache,
  
  /**
   * 短期缓存（1分钟）
   */
  short: createCacheMiddleware({
    ttl: 60,
    prefix: 'user_short',
    includeUser: true
  }),
  
  /**
   * 中期缓存（5分钟）
   */
  medium: createCacheMiddleware({
    ttl: 300,
    prefix: 'user_medium',
    includeUser: true
  }),
  
  /**
   * 长期缓存（30分钟）
   */
  long: createCacheMiddleware({
    ttl: 1800,
    prefix: 'user_long',
    includeUser: true
  })
};

/**
 * 用户端基础中间件栈
 * 所有用户端接口都会应用的基础中间件
 */
const baseStack = createMiddlewareChain()
  .use(userApiType)           // API类型标识
  .use(performanceMonitor)    // 性能监控
  .use(basicAudit)           // 基础审计
  .build();

/**
 * 用户端公开接口中间件栈
 * 不需要认证的公开接口
 */
const publicStack = createMiddlewareChain()
  .use(userApiType)
  .use(userLimiting.relaxed)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 用户端认证接口中间件栈
 * 需要用户认证的接口
 */
const authenticatedStack = createMiddlewareChain()
  .use(userApiType)
  .use(userLimiting.standard)
  .use(userAuth.required)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 用户端可选认证接口中间件栈
 * 可选认证的接口（有token则验证，无token则跳过）
 */
const optionalAuthStack = createMiddlewareChain()
  .use(userApiType)
  .use(userLimiting.standard)
  .use(userAuth.optional)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 用户端缓存接口中间件栈
 * 带缓存的认证接口
 */
const cachedStack = createMiddlewareChain()
  .use(userApiType)
  .use(userLimiting.standard)
  .use(userAuth.required)
  .use(userCaching.medium)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 用户端敏感操作中间件栈
 * 用于敏感操作的严格限流和审计
 */
const sensitiveStack = createMiddlewareChain()
  .use(userApiType)
  .use(userLimiting.strict)
  .use(userAuth.required)
  .use(userDataAudit)
  .use(performanceMonitor)
  .build();

/**
 * 用户端登录中间件栈
 * 专门用于登录接口
 */
const loginStack = createMiddlewareChain()
  .use(userApiType)
  .use(userLimiting.login)
  .use(performanceMonitor)
  .use(basicAudit)
  .build();

/**
 * 创建带权限的用户端中间件栈
 * @param {Array|string} permissions - 需要的权限
 * @param {Object} options - 选项配置
 * @returns {Array} 中间件数组
 */
function createPermissionStack(permissions, options = {}) {
  const {
    caching = false,
    strictLimiting = false,
    audit = true
  } = options;
  
  const chain = createMiddlewareChain()
    .use(userApiType)
    .use(strictLimiting ? userLimiting.strict : userLimiting.standard)
    .use(userAuth.withPermissions(permissions, options));
  
  if (caching) {
    chain.use(userCaching.medium);
  }
  
  chain.use(performanceMonitor);
  
  if (audit) {
    chain.use(userDataAudit);
  }
  
  return chain.toArray();
}

/**
 * 创建自定义用户端中间件栈
 * @param {Object} config - 配置选项
 * @returns {Array} 中间件数组
 */
function createCustomUserStack(config = {}) {
  const {
    auth = 'required',        // 'none', 'optional', 'required', 'permissions'
    permissions = [],
    limiting = 'standard',    // 'relaxed', 'standard', 'strict', 'login'
    caching = false,         // false, 'short', 'medium', 'long', 'userData'
    audit = true,
    performance = true
  } = config;
  
  const chain = createMiddlewareChain().use(userApiType);
  
  // 添加限流
  switch (limiting) {
    case 'relaxed':
      chain.use(userLimiting.relaxed);
      break;
    case 'strict':
      chain.use(userLimiting.strict);
      break;
    case 'login':
      chain.use(userLimiting.login);
      break;
    default:
      chain.use(userLimiting.standard);
  }
  
  // 添加认证
  switch (auth) {
    case 'optional':
      chain.use(userAuth.optional);
      break;
    case 'required':
      chain.use(userAuth.required);
      break;
    case 'permissions':
      chain.use(userAuth.withPermissions(permissions));
      break;
    // 'none' 不添加认证中间件
  }
  
  // 添加缓存
  if (caching) {
    switch (caching) {
      case 'short':
        chain.use(userCaching.short);
        break;
      case 'medium':
        chain.use(userCaching.medium);
        break;
      case 'long':
        chain.use(userCaching.long);
        break;
      case 'userData':
        chain.use(userCaching.userData);
        break;
      default:
        if (typeof caching === 'object') {
          chain.use(createCacheMiddleware(caching));
        }
    }
  }
  
  // 添加性能监控
  if (performance) {
    chain.use(performanceMonitor);
  }
  
  // 添加审计
  if (audit) {
    if (auth === 'permissions' || limiting === 'strict') {
      chain.use(userDataAudit);
    } else {
      chain.use(basicAudit);
    }
  }
  
  return chain.toArray();
}

/**
 * 用户端中间件栈集合
 */
const userMiddleware = {
  // 预定义栈
  base: baseStack,
  public: publicStack,
  authenticated: authenticatedStack,
  optionalAuth: optionalAuthStack,
  cached: cachedStack,
  sensitive: sensitiveStack,
  login: loginStack,
  
  // 工厂函数
  withPermissions: createPermissionStack,
  custom: createCustomUserStack,
  
  // 组件
  auth: userAuth,
  limiting: userLimiting,
  caching: userCaching
};

module.exports = userMiddleware;
