/**
 * API类型工具
 * 提供API类型标识和管理功能
 */

const { logger } = require('../../common/logger');
const { API_TYPE_CONFIG } = require('../config');

// API类型常量
const API_TYPES = API_TYPE_CONFIG.TYPES;

/**
 * 创建API类型标识中间件
 * @param {string} apiType - API类型 (user/admin/general)
 * @param {Object} options - 选项配置
 * @returns {Function} Express中间件函数
 */
function createApiTypeMiddleware(apiType, options = {}) {
  // 验证API类型
  if (!Object.values(API_TYPES).includes(apiType)) {
    throw new Error(`无效的API类型: ${apiType}. 支持的类型: ${Object.values(API_TYPES).join(', ')}`);
  }

  const {
    logRequests = process.env.NODE_ENV === 'development',
    customHeaders = {},
    validateUserType = false
  } = options;

  return function apiTypeMiddleware(req, res, next) {
    try {
      // 在请求对象中添加API类型标识
      req.apiType = apiType;
      
      // 设置标准响应头
      const headers = API_TYPE_CONFIG.HEADERS[apiType.toUpperCase()] || {};
      Object.entries(headers).forEach(([key, value]) => {
        res.set(key, value);
      });
      
      // 设置自定义响应头
      Object.entries(customHeaders).forEach(([key, value]) => {
        res.set(key, value);
      });
      
      // 记录API类型信息（仅在开发环境或明确启用时）
      if (logRequests) {
        logger.debug(`API类型: ${apiType}, 路径: ${req.path}, 方法: ${req.method}`);
      }
      
      // 验证用户类型匹配（可选）
      if (validateUserType && req.user) {
        const isValidUserType = validateUserTypeForApi(req.user, apiType);
        if (!isValidUserType) {
          logger.warn('用户类型与API类型不匹配', {
            userId: req.user.id,
            userRole: req.user.role,
            apiType,
            path: req.path
          });
          
          return res.status(403).json({
            success: false,
            message: '用户类型与接口类型不匹配',
            error: 'User type mismatch with API type'
          });
        }
      }
      
      next();
    } catch (error) {
      logger.error('API类型中间件错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}

/**
 * 验证用户类型是否适合访问指定API类型
 * @param {Object} user - 用户对象
 * @param {string} apiType - API类型
 * @returns {boolean} - 是否匹配
 */
function validateUserTypeForApi(user, apiType) {
  if (!user || !user.role) {
    return apiType === API_TYPES.GENERAL;
  }
  
  switch (apiType) {
    case API_TYPES.USER:
      // 用户端API：普通用户和管理员都可以访问
      return ['user', 'admin', 'super_admin'].includes(user.role);

    case API_TYPES.ADMIN:
      // 管理端API：只有管理员可以访问
      return ['admin', 'super_admin'].includes(user.role);

    case API_TYPES.MERCHANT:
      // 商户端API：只有商户用户可以访问
      return ['merchant'].includes(user.role);

    case API_TYPES.CONSOLE:
      // 总台API：只有总台管理员可以访问
      return user.role === 4; // CONSOLE_ADMIN

    case API_TYPES.GENERAL:
      // 通用API：所有用户都可以访问
      return true;

    default:
      return false;
  }
}

/**
 * 用户端API类型标识中间件
 */
const userApiType = createApiTypeMiddleware(API_TYPES.USER);

/**
 * 管理端API类型标识中间件
 */
const adminApiType = createApiTypeMiddleware(API_TYPES.ADMIN, {
  validateUserType: true // 管理端API启用用户类型验证
});

/**
 * 商户端API类型标识中间件
 */
const merchantApiType = createApiTypeMiddleware(API_TYPES.MERCHANT, {
  validateUserType: true // 商户端API启用用户类型验证
});

/**
 * 总台API类型标识中间件
 */
const consoleApiType = createApiTypeMiddleware(API_TYPES.CONSOLE, {
  validateUserType: true // 总台API启用用户类型验证
});

/**
 * 通用API类型标识中间件
 */
const generalApiType = createApiTypeMiddleware(API_TYPES.GENERAL);

/**
 * 获取请求的API类型
 * @param {Object} req - Express请求对象
 * @returns {string} API类型
 */
function getApiType(req) {
  return req.apiType || API_TYPES.GENERAL;
}

/**
 * 检查是否为指定类型的API
 * @param {Object} req - Express请求对象
 * @param {string} expectedType - 期望的API类型
 * @returns {boolean} 是否匹配
 */
function isApiType(req, expectedType) {
  return getApiType(req) === expectedType;
}

/**
 * 检查是否为用户端API
 * @param {Object} req - Express请求对象
 * @returns {boolean} 是否为用户端API
 */
function isUserApi(req) {
  return isApiType(req, API_TYPES.USER);
}

/**
 * 检查是否为管理端API
 * @param {Object} req - Express请求对象
 * @returns {boolean} 是否为管理端API
 */
function isAdminApi(req) {
  return isApiType(req, API_TYPES.ADMIN);
}

/**
 * 检查是否为商户端API
 * @param {Object} req - Express请求对象
 * @returns {boolean} 是否为商户端API
 */
function isMerchantApi(req) {
  return isApiType(req, API_TYPES.MERCHANT);
}

/**
 * 检查是否为总台API
 * @param {Object} req - Express请求对象
 * @returns {boolean} 是否为总台API
 */
function isConsoleApi(req) {
  return isApiType(req, API_TYPES.CONSOLE);
}

/**
 * 检查是否为通用API
 * @param {Object} req - Express请求对象
 * @returns {boolean} 是否为通用API
 */
function isGeneralApi(req) {
  return isApiType(req, API_TYPES.GENERAL);
}

/**
 * 根据路径自动检测API类型
 * @param {string} path - 请求路径
 * @returns {string} 检测到的API类型
 */
function detectApiTypeFromPath(path) {
  const normalizedPath = path.toLowerCase();
  
  // 总台路径模式
  const consolePatterns = [
    /^\/api\/admin\/console\//,
    /^\/api\/console\//,
    /^\/console\//,
    /^\/api\/v\d+\/console\//
  ];

  // 管理端路径模式
  const adminPatterns = [
    /^\/api\/admin\//,
    /^\/admin\//,
    /^\/api\/v\d+\/admin\//,
    /^\/management\//,
    /^\/api\/management\//
  ];

  // 商户端路径模式
  const merchantPatterns = [
    /^\/api\/merchant\//,
    /^\/merchant\//,
    /^\/api\/v\d+\/merchant\//
  ];

  // 用户端路径模式
  const userPatterns = [
    /^\/api\/user\//,
    /^\/user\//,
    /^\/api\/v\d+\/user\//,
    /^\/api\/v\d+\/users\/profile/,
    /^\/api\/v\d+\/users\/settings/
  ];
  
  // 检查总台模式（优先级最高）
  if (consolePatterns.some(pattern => pattern.test(normalizedPath))) {
    return API_TYPES.CONSOLE;
  }

  // 检查管理端模式
  if (adminPatterns.some(pattern => pattern.test(normalizedPath))) {
    return API_TYPES.ADMIN;
  }

  // 检查商户端模式
  if (merchantPatterns.some(pattern => pattern.test(normalizedPath))) {
    return API_TYPES.MERCHANT;
  }

  // 检查用户端模式
  if (userPatterns.some(pattern => pattern.test(normalizedPath))) {
    return API_TYPES.USER;
  }

  // 默认为通用API
  return API_TYPES.GENERAL;
}

/**
 * 自动API类型检测中间件
 * 根据请求路径自动设置API类型
 * @param {Object} options - 选项配置
 * @returns {Function} Express中间件函数
 */
function createAutoApiTypeMiddleware(options = {}) {
  const { fallbackType = API_TYPES.GENERAL } = options;
  
  return (req, res, next) => {
    // 如果已经设置了API类型，跳过自动检测
    if (req.apiType) {
      return next();
    }
    
    // 自动检测API类型
    const detectedType = detectApiTypeFromPath(req.path);
    
    // 创建对应的API类型中间件并执行
    const apiTypeMiddleware = createApiTypeMiddleware(detectedType || fallbackType);
    apiTypeMiddleware(req, res, next);
  };
}

/**
 * API类型统计信息
 */
const apiTypeStats = {
  [API_TYPES.USER]: 0,
  [API_TYPES.ADMIN]: 0,
  [API_TYPES.MERCHANT]: 0,
  [API_TYPES.CONSOLE]: 0,
  [API_TYPES.GENERAL]: 0
};

/**
 * API类型统计中间件
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - 下一个中间件
 */
function apiTypeStatsMiddleware(req, res, next) {
  const apiType = getApiType(req);
  if (apiTypeStats.hasOwnProperty(apiType)) {
    apiTypeStats[apiType]++;
  }
  next();
}

/**
 * 获取API类型统计信息
 * @returns {Object} API类型统计信息
 */
function getApiTypeStats() {
  return { ...apiTypeStats };
}

/**
 * 重置API类型统计信息
 */
function resetApiTypeStats() {
  Object.keys(apiTypeStats).forEach(key => {
    apiTypeStats[key] = 0;
  });
}

module.exports = {
  API_TYPES,
  createApiTypeMiddleware,
  createAutoApiTypeMiddleware,
  userApiType,
  adminApiType,
  merchantApiType,
  consoleApiType,
  generalApiType,
  getApiType,
  isApiType,
  isUserApi,
  isAdminApi,
  isMerchantApi,
  isConsoleApi,
  isGeneralApi,
  detectApiTypeFromPath,
  validateUserTypeForApi,
  apiTypeStatsMiddleware,
  getApiTypeStats,
  resetApiTypeStats
};
