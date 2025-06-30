/**
 * 管理端API中间件栈
 * 为管理端接口提供严格的认证、限流和权限控制
 */

const { requireAdmin, requireSuperAdmin, requirePermissions } = require('../core/auth');
const { adminRateLimit, strictRateLimit, createCustomRateLimit } = require('../core/rateLimit');
const { adminDataCache, createCacheMiddleware } = require('../core/cache');
const { adminApiType } = require('../utils/apiType');
const { basicAudit, adminOperationAudit, sensitiveOperationAudit } = require('../monitoring/audit');
const { performanceMonitor } = require('../monitoring/performance');
const { logger } = require('../../common/logger');
const { createMiddlewareChain } = require('../utils/helpers');

/**
 * 管理端认证中间件配置
 */
const adminAuth = {
  /**
   * 标准管理员认证
   */
  required: requireAdmin,
  
  /**
   * 超级管理员认证
   */
  superAdmin: requireSuperAdmin,
  
  /**
   * 带权限检查的管理员认证
   * @param {Array|string} permissions - 需要的权限
   * @param {Object} options - 选项配置
   * @returns {Function} 中间件函数
   */
  withPermissions: (permissions, options = {}) => {
    return requirePermissions(permissions, { ...options, requireAuth: true });
  },
  
  /**
   * 超级管理员权限检查
   * @param {Array|string} permissions - 需要的权限
   * @param {Object} options - 选项配置
   * @returns {Function} 中间件函数
   */
  superAdminWithPermissions: (permissions, options = {}) => {
    return createMiddlewareChain()
      .use(requireSuperAdmin)
      .use(requirePermissions(permissions, { ...options, requireAuth: false }))
      .build();
  }
};

/**
 * 管理端限流配置
 */
const adminLimiting = {
  /**
   * 标准管理员限流
   */
  standard: adminRateLimit,
  
  /**
   * 严格限流（用于敏感操作）
   */
  strict: strictRateLimit,
  
  /**
   * 超级管理员限流（更宽松）
   */
  superAdmin: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000, // 每15分钟1000次请求
    type: 'super_admin'
  }),
  
  /**
   * 批量操作限流
   */
  batch: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 50, // 每15分钟50次批量操作
    type: 'admin_batch'
  }),
  
  /**
   * 数据导出限流
   */
  export: createCustomRateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 10, // 每小时10次导出操作
    type: 'admin_export'
  })
};

/**
 * 管理端缓存配置
 */
const adminCaching = {
  /**
   * 管理数据缓存
   */
  adminData: adminDataCache,
  
  /**
   * 短期缓存（30秒）
   */
  short: createCacheMiddleware({
    ttl: 30,
    prefix: 'admin_short',
    includeUser: true
  }),
  
  /**
   * 中期缓存（3分钟）
   */
  medium: createCacheMiddleware({
    ttl: 180,
    prefix: 'admin_medium',
    includeUser: true
  }),
  
  /**
   * 统计数据缓存（10分钟）
   */
  stats: createCacheMiddleware({
    ttl: 600,
    prefix: 'admin_stats',
    includeUser: false // 统计数据不需要用户特定化
  })
};

/**
 * 管理端审计配置
 */
const adminAuditing = {
  /**
   * 基础审计
   */
  basic: basicAudit,
  
  /**
   * 管理员操作审计
   */
  operation: adminOperationAudit,
  
  /**
   * 敏感操作审计
   * @param {string} operationType - 操作类型
   * @param {Object} options - 审计选项
   * @returns {Function} 审计中间件
   */
  sensitive: (operationType, options = {}) => {
    return sensitiveOperationAudit(operationType, {
      riskLevel: 'high',
      metadata: { category: 'admin', ...options.metadata },
      ...options
    });
  }
};

/**
 * 管理端基础中间件栈
 * 所有管理端接口都会应用的基础中间件
 */
const baseStack = createMiddlewareChain()
  .use(adminApiType)          // API类型标识
  .use(adminLimiting.standard) // 标准限流
  .use(adminAuth.required)    // 管理员认证
  .use(performanceMonitor)    // 性能监控
  .use(adminAuditing.operation) // 管理员操作审计
  .build();

/**
 * 管理端标准操作中间件栈
 * 用于一般的管理操作
 */
const standardStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.standard)
  .use(adminAuth.required)
  .use(performanceMonitor)
  .use(adminAuditing.operation)
  .build();

/**
 * 管理端敏感操作中间件栈
 * 用于敏感的管理操作
 */
const sensitiveStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.strict)
  .use(adminAuth.required)
  .use(adminAuditing.sensitive('SENSITIVE_ADMIN_OPERATION'))
  .use(performanceMonitor)
  .build();

/**
 * 管理端超级管理员中间件栈
 * 只有超级管理员可以访问的接口
 */
const superAdminStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.superAdmin)
  .use(adminAuth.superAdmin)
  .use(adminAuditing.sensitive('SUPER_ADMIN_OPERATION'))
  .use(performanceMonitor)
  .build();

/**
 * 管理端批量操作中间件栈
 * 用于批量处理操作
 */
const batchStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.batch)
  .use(adminAuth.required)
  .use(adminAuditing.sensitive('BATCH_OPERATION'))
  .use(performanceMonitor)
  .build();

/**
 * 管理端数据导出中间件栈
 * 用于数据导出操作
 */
const exportStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.export)
  .use(adminAuth.required)
  .use(adminAuditing.sensitive('DATA_EXPORT'))
  .use(performanceMonitor)
  .build();

/**
 * 管理端缓存查询中间件栈
 * 用于可缓存的查询操作
 */
const cachedQueryStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.standard)
  .use(adminAuth.required)
  .use(adminCaching.medium)
  .use(performanceMonitor)
  .use(adminAuditing.basic)
  .build();

/**
 * 管理端统计数据中间件栈
 * 用于统计数据查询
 */
const statsStack = createMiddlewareChain()
  .use(adminApiType)
  .use(adminLimiting.standard)
  .use(adminAuth.required)
  .use(adminCaching.stats)
  .use(performanceMonitor)
  .use(adminAuditing.basic)
  .build();

/**
 * 创建带权限的管理端中间件栈
 * @param {Array|string} permissions - 需要的权限
 * @param {Object} options - 选项配置
 * @returns {Array} 中间件数组
 */
function createPermissionStack(permissions, options = {}) {
  const {
    superAdminRequired = false,
    strictLimiting = false,
    caching = false,
    operationType = 'PERMISSION_OPERATION'
  } = options;
  
  const chain = createMiddlewareChain()
    .use(adminApiType)
    .use(strictLimiting ? adminLimiting.strict : adminLimiting.standard);
  
  if (superAdminRequired) {
    chain.use(adminAuth.superAdminWithPermissions(permissions, options));
  } else {
    chain.use(adminAuth.withPermissions(permissions, options));
  }
  
  if (caching) {
    chain.use(adminCaching.medium);
  }
  
  chain
    .use(adminAuditing.sensitive(operationType, options))
    .use(performanceMonitor);
  
  return chain.toArray();
}

/**
 * 创建自定义管理端中间件栈
 * @param {Object} config - 配置选项
 * @returns {Array} 中间件数组
 */
function createCustomAdminStack(config = {}) {
  const {
    auth = 'admin',           // 'admin', 'superAdmin', 'permissions'
    permissions = [],
    limiting = 'standard',    // 'standard', 'strict', 'superAdmin', 'batch', 'export'
    caching = false,         // false, 'short', 'medium', 'stats', 'adminData'
    audit = 'operation',     // 'basic', 'operation', 'sensitive'
    operationType = 'CUSTOM_ADMIN_OPERATION',
    performance = true
  } = config;
  
  const chain = createMiddlewareChain().use(adminApiType);
  
  // 添加限流
  switch (limiting) {
    case 'strict':
      chain.use(adminLimiting.strict);
      break;
    case 'superAdmin':
      chain.use(adminLimiting.superAdmin);
      break;
    case 'batch':
      chain.use(adminLimiting.batch);
      break;
    case 'export':
      chain.use(adminLimiting.export);
      break;
    default:
      chain.use(adminLimiting.standard);
  }
  
  // 添加认证
  switch (auth) {
    case 'superAdmin':
      chain.use(adminAuth.superAdmin);
      break;
    case 'permissions':
      chain.use(adminAuth.withPermissions(permissions));
      break;
    default:
      chain.use(adminAuth.required);
  }
  
  // 添加缓存
  if (caching) {
    switch (caching) {
      case 'short':
        chain.use(adminCaching.short);
        break;
      case 'medium':
        chain.use(adminCaching.medium);
        break;
      case 'stats':
        chain.use(adminCaching.stats);
        break;
      case 'adminData':
        chain.use(adminCaching.adminData);
        break;
      default:
        if (typeof caching === 'object') {
          chain.use(createCacheMiddleware(caching));
        }
    }
  }
  
  // 添加审计
  switch (audit) {
    case 'basic':
      chain.use(adminAuditing.basic);
      break;
    case 'sensitive':
      chain.use(adminAuditing.sensitive(operationType, config));
      break;
    default:
      chain.use(adminAuditing.operation);
  }
  
  // 添加性能监控
  if (performance) {
    chain.use(performanceMonitor);
  }
  
  return chain.toArray();
}

/**
 * 管理端中间件栈集合
 */
const adminMiddleware = {
  // 预定义栈
  base: baseStack,
  standard: standardStack,
  sensitive: sensitiveStack,
  superAdmin: superAdminStack,
  batch: batchStack,
  export: exportStack,
  cachedQuery: cachedQueryStack,
  stats: statsStack,
  
  // 工厂函数
  withPermissions: createPermissionStack,
  custom: createCustomAdminStack,
  
  // 组件
  auth: adminAuth,
  limiting: adminLimiting,
  caching: adminCaching,
  auditing: adminAuditing
};

module.exports = adminMiddleware;
