/**
 * 商户端API中间件栈
 * 为商户端接口提供专门的认证、限流和权限控制
 */

const { baseAuth, requireAuth, requirePermissions } = require('../core/auth');
const { createCustomRateLimit } = require('../core/rateLimit');
const { createCacheMiddleware } = require('../core/cache');
const { createApiTypeMiddleware } = require('../utils/apiType');
const { basicAudit, sensitiveOperationAudit } = require('../monitoring/audit');
const { performanceMonitor } = require('../monitoring/performance');
const { logger } = require('../../common/logger');
const { createMiddlewareChain } = require('../utils/helpers');

/**
 * 商户端API类型标识中间件
 */
const merchantApiType = createApiTypeMiddleware('merchant', {
  headers: {
    'X-API-Type': 'merchant',
    'X-API-Audience': 'merchant-user'
  }
});

/**
 * 商户端认证中间件配置
 */
const merchantAuth = {
  /**
   * 必须认证的中间件（商户端专用）
   */
  required: (req, res, next) => {
    // 先进行基础认证
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      
      // 验证用户是否为商户
      if (!req.user || !req.user.merchantId) {
        return res.status(403).json({
          success: 0,
          message: '需要商户身份认证',
          code: 'MERCHANT_AUTH_REQUIRED'
        });
      }
      
      // 将商户ID添加到请求对象
      req.merchantId = req.user.merchantId;
      next();
    });
  },
  
  /**
   * 可选认证的中间件
   * 如果提供了token则验证，没有提供则跳过
   */
  optional: (req, res, next) => {
    baseAuth(req, res, (err) => {
      if (err) return next(err);
      
      // 如果有用户信息且是商户，则添加商户ID
      if (req.user && req.user.merchantId) {
        req.merchantId = req.user.merchantId;
      }
      next();
    });
  },
  
  /**
   * 带权限检查的认证中间件
   * @param {Array|string} permissions - 需要的权限
   * @param {Object} options - 选项配置
   * @returns {Function} 中间件函数
   */
  withPermissions: (permissions, options = {}) => {
    return (req, res, next) => {
      merchantAuth.required(req, res, (err) => {
        if (err) return next(err);
        
        // 检查商户权限
        requirePermissions(permissions, {
          ...options,
          requireAuth: false, // 已经在上面验证过
          userType: 'merchant'
        })(req, res, next);
      });
    };
  },
  
  /**
   * 商户店铺权限验证
   * 确保商户只能访问自己的店铺数据
   */
  shopAccess: (req, res, next) => {
    merchantAuth.required(req, res, (err) => {
      if (err) return next(err);
      
      const shopId = req.params.shopId || req.body.shopId || req.query.shopId;
      
      if (shopId && req.user.shopIds && !req.user.shopIds.includes(parseInt(shopId))) {
        return res.status(403).json({
          success: 0,
          message: '无权访问该店铺数据',
          code: 'SHOP_ACCESS_DENIED'
        });
      }
      
      next();
    });
  }
};

/**
 * 商户端限流配置
 */
const merchantLimiting = {
  /**
   * 标准商户限流（比用户端更宽松，因为商户端可能有更多API调用需求）
   */
  standard: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1500, // 每15分钟1500次请求
    message: {
      success: 0,
      message: '商户端API请求过于频繁，请稍后重试',
      code: 'MERCHANT_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
      return `merchant_${req.merchantId || req.ip}`;
    }
  }),
  
  /**
   * 宽松限流（用于不敏感的查询操作）
   */
  relaxed: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 3000, // 每15分钟3000次请求
    keyGenerator: (req) => {
      return `merchant_relaxed_${req.merchantId || req.ip}`;
    }
  }),
  
  /**
   * 严格限流（用于敏感操作）
   */
  strict: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 200, // 每15分钟200次请求
    keyGenerator: (req) => {
      return `merchant_strict_${req.merchantId || req.ip}`;
    }
  }),
  
  /**
   * 登录限流
   */
  login: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 15, // 每15分钟15次登录尝试
    keyGenerator: (req) => {
      return `merchant_login_${req.ip}`;
    }
  }),
  
  /**
   * 商品操作限流
   */
  product: createCustomRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 500, // 每15分钟500次商品操作
    keyGenerator: (req) => {
      return `merchant_product_${req.merchantId || req.ip}`;
    }
  })
};

/**
 * 商户端缓存配置
 */
const merchantCaching = {
  /**
   * 商户数据缓存
   */
  merchantData: createCacheMiddleware({
    ttl: 600, // 10分钟
    prefix: 'merchant_data',
    includeUser: true,
    keyGenerator: (req) => {
      return `${req.merchantId}_${req.originalUrl}`;
    }
  }),
  
  /**
   * 短期缓存（2分钟）
   */
  short: createCacheMiddleware({
    ttl: 120,
    prefix: 'merchant_short',
    includeUser: true,
    keyGenerator: (req) => {
      return `${req.merchantId}_${req.originalUrl}`;
    }
  }),
  
  /**
   * 中期缓存（10分钟）
   */
  medium: createCacheMiddleware({
    ttl: 600,
    prefix: 'merchant_medium',
    includeUser: true,
    keyGenerator: (req) => {
      return `${req.merchantId}_${req.originalUrl}`;
    }
  }),
  
  /**
   * 长期缓存（30分钟）
   */
  long: createCacheMiddleware({
    ttl: 1800,
    prefix: 'merchant_long',
    includeUser: true,
    keyGenerator: (req) => {
      return `${req.merchantId}_${req.originalUrl}`;
    }
  }),
  
  /**
   * 商品列表缓存（5分钟）
   */
  productList: createCacheMiddleware({
    ttl: 300,
    prefix: 'merchant_products',
    includeUser: true,
    keyGenerator: (req) => {
      const { page = 1, limit = 20, category, status } = req.query;
      return `${req.merchantId}_products_${page}_${limit}_${category || 'all'}_${status || 'all'}`;
    }
  })
};

/**
 * 商户端审计配置
 */
const merchantAuditing = {
  /**
   * 基础审计
   */
  basic: basicAudit,

  /**
   * 商户操作审计
   */
  operation: (req, res, next) => {
    // 扩展基础审计，添加商户信息
    const originalAudit = basicAudit(req, res, next);
    if (req.merchantId) {
      req.auditData = {
        ...req.auditData,
        merchantId: req.merchantId,
        userType: 'merchant'
      };
    }
    return originalAudit;
  },

  /**
   * 敏感操作审计
   * @param {string} operationType - 操作类型
   * @param {Object} options - 审计选项
   * @returns {Function} 审计中间件
   */
  sensitive: (operationType, options = {}) => {
    return sensitiveOperationAudit(operationType, {
      riskLevel: 'medium',
      metadata: { category: 'merchant', ...options.metadata },
      ...options
    });
  }
};

/**
 * 商户端基础中间件栈
 * 所有商户端接口都会应用的基础中间件
 */
const baseStack = createMiddlewareChain()
  .use(merchantApiType)          // API类型标识
  .use(performanceMonitor)       // 性能监控
  .use(merchantAuditing.basic)   // 基础审计
  .build();

/**
 * 商户端公开接口中间件栈
 * 不需要认证的公开接口（如商户注册）
 */
const publicStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.relaxed)
  .use(performanceMonitor)
  .use(merchantAuditing.basic)
  .build();

/**
 * 商户端认证接口中间件栈
 * 需要商户认证的接口
 */
const authenticatedStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.standard)
  .use(merchantAuth.required)
  .use(performanceMonitor)
  .use(merchantAuditing.operation)
  .build();

/**
 * 商户端可选认证接口中间件栈
 * 可选认证的接口（有token则验证，无token则跳过）
 */
const optionalAuthStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.standard)
  .use(merchantAuth.optional)
  .use(performanceMonitor)
  .use(merchantAuditing.basic)
  .build();

/**
 * 商户端缓存接口中间件栈
 * 带缓存的认证接口
 */
const cachedStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.standard)
  .use(merchantAuth.required)
  .use(merchantCaching.medium)
  .use(performanceMonitor)
  .use(merchantAuditing.operation)
  .build();

/**
 * 商户端敏感操作中间件栈
 * 用于敏感操作的严格限流和审计
 */
const sensitiveStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.strict)
  .use(merchantAuth.required)
  .use(merchantAuditing.sensitive('SENSITIVE_MERCHANT_OPERATION'))
  .use(performanceMonitor)
  .build();

/**
 * 商户端登录中间件栈
 * 专门用于登录接口
 */
const loginStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.login)
  .use(performanceMonitor)
  .use(merchantAuditing.basic)
  .build();

/**
 * 商户端商品操作中间件栈
 * 专门用于商品相关操作
 */
const productStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.product)
  .use(merchantAuth.required)
  .use(merchantCaching.productList)
  .use(performanceMonitor)
  .use(merchantAuditing.operation)
  .build();

/**
 * 商户端店铺访问中间件栈
 * 需要店铺权限验证的接口
 */
const shopAccessStack = createMiddlewareChain()
  .use(merchantApiType)
  .use(merchantLimiting.standard)
  .use(merchantAuth.shopAccess)
  .use(performanceMonitor)
  .use(merchantAuditing.operation)
  .build();

/**
 * 创建带权限的商户端中间件栈
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
    .use(merchantApiType)
    .use(strictLimiting ? merchantLimiting.strict : merchantLimiting.standard)
    .use(merchantAuth.withPermissions(permissions, options));

  if (caching) {
    chain.use(merchantCaching.medium);
  }

  chain.use(performanceMonitor);

  if (audit) {
    chain.use(merchantAuditing.sensitive('MERCHANT_PERMISSION_OPERATION'));
  }

  return chain.toArray();
}

/**
 * 创建自定义商户端中间件栈
 * @param {Object} config - 配置选项
 * @returns {Array} 中间件数组
 */
function createCustomMerchantStack(config = {}) {
  const {
    auth = 'required',        // 'none', 'optional', 'required', 'permissions', 'shopAccess'
    permissions = [],
    limiting = 'standard',    // 'relaxed', 'standard', 'strict', 'login', 'product'
    caching = false,         // false, 'short', 'medium', 'long', 'merchantData', 'productList'
    audit = true,
    performance = true
  } = config;

  const chain = createMiddlewareChain().use(merchantApiType);

  // 添加限流
  switch (limiting) {
    case 'relaxed':
      chain.use(merchantLimiting.relaxed);
      break;
    case 'strict':
      chain.use(merchantLimiting.strict);
      break;
    case 'login':
      chain.use(merchantLimiting.login);
      break;
    case 'product':
      chain.use(merchantLimiting.product);
      break;
    default:
      chain.use(merchantLimiting.standard);
  }

  // 添加认证
  switch (auth) {
    case 'optional':
      chain.use(merchantAuth.optional);
      break;
    case 'required':
      chain.use(merchantAuth.required);
      break;
    case 'permissions':
      chain.use(merchantAuth.withPermissions(permissions));
      break;
    case 'shopAccess':
      chain.use(merchantAuth.shopAccess);
      break;
    // 'none' 不添加认证中间件
  }

  // 添加缓存
  if (caching) {
    switch (caching) {
      case 'short':
        chain.use(merchantCaching.short);
        break;
      case 'medium':
        chain.use(merchantCaching.medium);
        break;
      case 'long':
        chain.use(merchantCaching.long);
        break;
      case 'merchantData':
        chain.use(merchantCaching.merchantData);
        break;
      case 'productList':
        chain.use(merchantCaching.productList);
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
      chain.use(merchantAuditing.sensitive('MERCHANT_CUSTOM_OPERATION'));
    } else {
      chain.use(merchantAuditing.operation);
    }
  }

  return chain.toArray();
}

/**
 * 商户端中间件栈集合
 */
const merchantMiddleware = {
  // 预定义栈
  base: baseStack,
  public: publicStack,
  authenticated: authenticatedStack,
  optionalAuth: optionalAuthStack,
  cached: cachedStack,
  sensitive: sensitiveStack,
  login: loginStack,
  product: productStack,
  shopAccess: shopAccessStack,

  // 工厂函数
  withPermissions: createPermissionStack,
  custom: createCustomMerchantStack,

  // 组件
  auth: merchantAuth,
  limiting: merchantLimiting,
  caching: merchantCaching,
  auditing: merchantAuditing
};

module.exports = merchantMiddleware;
