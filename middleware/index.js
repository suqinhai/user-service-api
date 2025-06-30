/**
 * 中间件统一导出文件
 * 提供所有中间件的统一访问接口
 */

// 核心中间件
const auth = require('./core/auth');
const rateLimit = require('./core/rateLimit');
const cache = require('./core/cache');
const validator = require('./core/validator');
const errorHandler = require('./core/errorHandler');

// 监控中间件
const performance = require('./monitoring/performance');
const audit = require('./monitoring/audit');

// 工具函数
const apiType = require('./utils/apiType');
const helpers = require('./utils/helpers');

// API中间件栈
const userMiddleware = require('./api/user');
const adminMiddleware = require('./api/admin');
const merchantMiddleware = require('./api/merchant');
const commonMiddleware = require('./api/common');

// 配置
const config = require('./config');

/**
 * 核心中间件模块
 */
const core = {
  auth,
  rateLimit,
  cache,
  validator,
  errorHandler
};

/**
 * 监控中间件模块
 */
const monitoring = {
  performance,
  audit
};

/**
 * 工具模块
 */
const utils = {
  apiType,
  helpers
};

/**
 * API中间件栈模块
 */
const api = {
  user: userMiddleware,
  admin: adminMiddleware,
  merchant: merchantMiddleware,
  common: commonMiddleware
};

/**
 * 快速访问常用中间件
 */
const quick = {
  // 认证相关
  requireAuth: auth.requireAuth,
  requireAdmin: auth.requireAdmin,
  requireSuperAdmin: auth.requireSuperAdmin,
  requirePermissions: auth.requirePermissions,
  baseAuth: auth.baseAuth,
  
  // 限流相关
  userRateLimit: rateLimit.userRateLimit,
  adminRateLimit: rateLimit.adminRateLimit,
  generalRateLimit: rateLimit.generalRateLimit,
  strictRateLimit: rateLimit.strictRateLimit,
  loginRateLimit: rateLimit.loginRateLimit,
  
  // 缓存相关
  userDataCache: cache.userDataCache,
  adminDataCache: cache.adminDataCache,
  staticDataCache: cache.staticDataCache,
  createCacheMiddleware: cache.createCacheMiddleware,
  
  // 验证相关
  validate: validator.validate,
  rules: validator.rules,
  commonValidations: validator.commonValidations,
  
  // 错误处理
  errorHandler: errorHandler.errorHandler,
  notFoundHandler: errorHandler.notFoundHandler,
  asyncHandler: errorHandler.asyncHandler,
  AppError: errorHandler.AppError,
  ValidationError: errorHandler.ValidationError,
  AuthenticationError: errorHandler.AuthenticationError,
  AuthorizationError: errorHandler.AuthorizationError,
  NotFoundError: errorHandler.NotFoundError,
  
  // API类型
  userApiType: apiType.userApiType,
  adminApiType: apiType.adminApiType,
  generalApiType: apiType.generalApiType,
  getApiType: apiType.getApiType,
  isApiType: apiType.isApiType,
  
  // 监控
  performanceMonitor: performance.performanceMonitor,
  basicAudit: audit.basicAudit,
  adminOperationAudit: audit.adminOperationAudit,
  
  // 工具
  asyncMiddleware: helpers.asyncMiddleware,
  conditionalMiddleware: helpers.conditionalMiddleware,
  createMiddlewareChain: helpers.createMiddlewareChain
};

/**
 * 预定义中间件栈
 */
const stacks = {
  // 用户端栈
  user: {
    public: userMiddleware.public,
    authenticated: userMiddleware.authenticated,
    optionalAuth: userMiddleware.optionalAuth,
    cached: userMiddleware.cached,
    sensitive: userMiddleware.sensitive,
    login: userMiddleware.login
  },
  
  // 管理端栈
  admin: {
    standard: adminMiddleware.standard,
    sensitive: adminMiddleware.sensitive,
    superAdmin: adminMiddleware.superAdmin,
    batch: adminMiddleware.batch,
    export: adminMiddleware.export,
    cachedQuery: adminMiddleware.cachedQuery,
    stats: adminMiddleware.stats
  },

  // 商户端栈
  merchant: {
    public: merchantMiddleware.public,
    authenticated: merchantMiddleware.authenticated,
    optionalAuth: merchantMiddleware.optionalAuth,
    cached: merchantMiddleware.cached,
    sensitive: merchantMiddleware.sensitive,
    login: merchantMiddleware.login,
    product: merchantMiddleware.product,
    shopAccess: merchantMiddleware.shopAccess
  },
  
  // 通用栈
  common: {
    public: commonMiddleware.public,
    optionalAuth: commonMiddleware.optionalAuth,
    cached: commonMiddleware.cached,
    static: commonMiddleware.static,
    docs: commonMiddleware.docs,
    health: commonMiddleware.health,
    autoType: commonMiddleware.autoType
  }
};

/**
 * 中间件工厂函数
 */
const factories = {
  // 用户端工厂
  createUserStack: userMiddleware.custom,
  createUserPermissionStack: userMiddleware.withPermissions,
  
  // 管理端工厂
  createAdminStack: adminMiddleware.custom,
  createAdminPermissionStack: adminMiddleware.withPermissions,

  // 商户端工厂
  createMerchantStack: merchantMiddleware.custom,
  createMerchantPermissionStack: merchantMiddleware.withPermissions,
  
  // 通用工厂
  createCommonStack: commonMiddleware.custom,
  createConditionalAuthStack: commonMiddleware.conditionalAuth,
  
  // 核心工厂
  createRateLimit: rateLimit.createCustomRateLimit,
  createCache: cache.createCacheMiddleware,
  createValidator: validator.validate,
  createErrorHandler: errorHandler.createErrorHandler,
  createApiType: apiType.createApiTypeMiddleware,
  createAudit: audit.sensitiveOperationAudit
};

/**
 * 中间件统计和管理
 */
const management = {
  // 性能统计
  getPerformanceStats: performance.getPerformanceStats,
  resetPerformanceStats: performance.resetPerformanceStats,
  generatePerformanceReport: performance.generatePerformanceReport,
  
  // 审计日志
  getAuditLogs: audit.getAuditLogs,
  cleanupExpiredLogs: audit.cleanupExpiredLogs,
  
  // API类型统计
  getApiTypeStats: apiType.getApiTypeStats,
  resetApiTypeStats: apiType.resetApiTypeStats,
  
  // 缓存预热
  warmupCache: cache.warmupCache
};

/**
 * 中间件配置
 */
const { 
  RATE_LIMIT_CONFIG, 
  CACHE_CONFIG, 
  AUTH_CONFIG, 
  API_TYPE_CONFIG, 
  PERFORMANCE_CONFIG, 
  AUDIT_CONFIG, 
  ERROR_CONFIG 
} = config;

/**
 * 向后兼容的导出（保持与原有middleware/index.js的兼容性）
 */
const legacyExports = {
  // 认证中间件（兼容原有导出）
  validateUser: auth.requireAuth,
  validateAdmin: auth.requireAdmin,

  // 限流中间件（兼容原有导出）
  globalLimiter: rateLimit.generalRateLimit,

  // 其他原有导出
  cache: cache.userDataCache,
  modelCache: cache.adminDataCache,
  apiType: apiType.generalApiType,
  userApi: userMiddleware.authenticated,
  adminApi: adminMiddleware.standard,
  merchantApi: merchantMiddleware.authenticated
};

// 主导出对象
module.exports = {
  // 模块化导出
  core,
  monitoring,
  utils,
  api,
  config: {
    RATE_LIMIT_CONFIG,
    CACHE_CONFIG,
    AUTH_CONFIG,
    API_TYPE_CONFIG,
    PERFORMANCE_CONFIG,
    AUDIT_CONFIG,
    ERROR_CONFIG
  },
  
  // 快速访问
  quick,
  stacks,
  factories,
  management,
  
  // 向后兼容
  ...legacyExports,
  
  // 便捷方法
  /**
   * 初始化中间件系统
   * @param {Object} options - 初始化选项
   */
  init: async (options = {}) => {
    const { warmupCache: shouldWarmup = true } = options;
    
    if (shouldWarmup) {
      await cache.warmupCache();
    }
    
    console.log('中间件系统初始化完成');
  },
  
  /**
   * 获取中间件使用指南
   * @returns {Object} 使用指南
   */
  getUsageGuide: () => ({
    quickStart: {
      userAuth: 'middleware.quick.requireAuth',
      adminAuth: 'middleware.quick.requireAdmin',
      rateLimit: 'middleware.quick.userRateLimit',
      cache: 'middleware.quick.userDataCache',
      validation: 'middleware.quick.validate([middleware.quick.rules.username()])'
    },
    stacks: {
      userPublic: 'middleware.stacks.user.public',
      userAuth: 'middleware.stacks.user.authenticated',
      adminStandard: 'middleware.stacks.admin.standard',
      adminSensitive: 'middleware.stacks.admin.sensitive',
      merchantAuth: 'middleware.stacks.merchant.authenticated',
      merchantProduct: 'middleware.stacks.merchant.product'
    },
    factories: {
      customUser: 'middleware.factories.createUserStack({ auth: "required", caching: "medium" })',
      customAdmin: 'middleware.factories.createAdminStack({ auth: "superAdmin", audit: "sensitive" })',
      customMerchant: 'middleware.factories.createMerchantStack({ auth: "required", limiting: "product", caching: "productList" })',
      customCommon: 'middleware.factories.createCommonStack({ limiting: "relaxed", caching: "long" })'
    }
  })
};
