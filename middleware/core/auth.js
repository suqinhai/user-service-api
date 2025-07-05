/**
 * 核心认证中间件
 * 提供统一的认证功能，支持用户和管理员认证
 */

const jwt = require('jsonwebtoken');
const { merchantUserModel } = require('../../models');
const CacheManager = require('../../common/redis/cache');
const { PREFIX, TTL } = require('../../common/redis');
const { sendUnauthorized, sendBadRequest } = require('../../common/routeHandler');
const { AUTH_CONFIG } = require('../config');
const { logger } = require('../../common/logger');
const { USER_STATUS, USER_ROLE, AUTH_STATUS, COMMON_STATUS } = require('../../common/constants/status');
const { StatusHelper } = require('../../common/utils/statusHelper');

/**
 * 验证JWT token
 * @param {string} token - JWT令牌
 * @param {string} secret - JWT密钥
 * @returns {Object|null} - 解析后的token数据或null
 */
const verifyToken = (token, secret = AUTH_CONFIG.JWT.secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    logger.debug('Token验证失败:', error.message);
    return null;
  }
};

/**
 * 从数据库获取用户信息
 * @param {number} userId - 用户ID
 * @returns {Promise<Object|null>} - 用户对象或null
 */
async function getUserById(userId) {
  try {
    return await merchantUserModel.findByPk(userId);
  } catch (error) {
    logger.error(`通过ID获取用户失败: ${userId}`, error);
    return null;
  }
}

/**
 * 从请求中提取token
 * @param {Object} req - 请求对象
 * @returns {string|null} - token或null
 */
function extractToken(req) {
  // 从Authorization header提取
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 从query参数提取（不推荐，仅用于特殊情况）
  if (req.query.token) {
    return req.query.token;
  }

  return null;
}

/**
 * 基础认证中间件
 * 验证token并获取用户信息，但不强制要求认证
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 * @returns {Promise<void>}
 */
const baseAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      req.isAuthenticated = AUTH_STATUS.NOT_AUTHENTICATED;
      return next();
    }
    
    // 检查token缓存
    const tokenKey = `${token.substring(0, 10)}`;
    const cachedTokenData = await CacheManager.get(PREFIX.TOKEN, tokenKey);

    let decoded;
    if (cachedTokenData) {
      decoded = cachedTokenData;
    } else {
      decoded = verifyToken(token);
      if (!decoded) {
        req.user = null;
        req.isAuthenticated = AUTH_STATUS.TOKEN_INVALID;
        return next();
      }

      // 缓存token解析结果
      await CacheManager.set(PREFIX.TOKEN, tokenKey, decoded, AUTH_CONFIG.TOKEN_CACHE.ttl);
    }

    // 使用缓存获取用户信息
    const user = await CacheManager.getOrFetch(
      PREFIX.USER,
      decoded.id,
      () => getUserById(decoded.id),
      AUTH_CONFIG.USER_CACHE.ttl
    );

    if (!user) {
      req.user = null;
      req.isAuthenticated = AUTH_STATUS.NOT_AUTHENTICATED;
      return next();
    }

    // 检查用户状态
    if (!StatusHelper.isUserActive(user.status)) {
      req.user = null;
      req.isAuthenticated = AUTH_STATUS.NOT_AUTHENTICATED;
      return next();
    }

    req.user = user;
    req.isAuthenticated = AUTH_STATUS.AUTHENTICATED;
    next();
  } catch (error) {
    logger.error('基础认证中间件错误:', error);
    req.user = null;
    req.isAuthenticated = AUTH_STATUS.NOT_AUTHENTICATED;
    next();
  }
};

/**
 * 必须认证中间件
 * 要求用户必须通过认证
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 * @returns {Promise<void>}
 */
const requireAuth = async (req, res, next) => {
  try {
    // 先执行基础认证
    await baseAuth(req, res, () => {
      if (!req.isAuthenticated || !req.user) {
        return res.sendUnauthorized('需要登录才能访问此接口');
      }

      if (!StatusHelper.isUserActive(req.user.status)) {
        return res.sendUnauthorized('用户状态异常');
      }

      next();
    });
  } catch (error) {
    logger.error('必须认证中间件错误:', error);
    res.status(500).json({
      success: COMMON_STATUS.FAILED,
      message: '认证服务异常'
    });
  }
};

/**
 * 管理员认证中间件
 * 要求用户必须是管理员
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 * @returns {Promise<void>}
 */
const requireAdmin = async (req, res, next) => {
  try {
    await requireAuth(req, res, () => {
      if (req.user.role !== 30) {
        return res.sendUnauthorized('权限不足，需要管理员权限');
      }
      next();
    });
  } catch (error) {
    logger.error('管理员认证中间件错误:', error);
    res.status(500).json({
      success: COMMON_STATUS.FAILED,
      message: '认证服务异常'
    });
  }
};

/**
 * 权限检查中间件工厂
 * @param {Array|string} permissions - 需要的权限
 * @param {Object} options - 选项配置
 * @returns {Function} 中间件函数
 */
function requirePermissions(permissions, options = {}) {
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  const { requireAll = COMMON_STATUS.NO, requireAuth: needAuth = COMMON_STATUS.YES } = options;

  return async (req, res, next) => {
    try {
      const authMiddleware = needAuth ? requireAuth : baseAuth;

      await authMiddleware(req, res, () => {
        if (needAuth && (!req.isAuthenticated || !req.user)) {
          return res.sendUnauthorized('需要登录才能访问此接口');
        }

        if (!req.user) {
          return next(); // 如果不需要认证且用户未登录，直接通过
        }

        // 检查用户状态
        if (req.user.status != '1') {
          return res.sendUnauthorized('用户状态异常，无法访问');
        }

        // 检查权限
        if (permissionArray.length > 0 && req.user.permissions) {
          const userPermissions = req.user.permissions || [];

          let hasPermission;
          if (requireAll) {
            hasPermission = permissionArray.every(permission =>
              userPermissions.includes(permission)
            );
          } else {
            hasPermission = permissionArray.some(permission =>
              userPermissions.includes(permission)
            );
          }

          if (!hasPermission) {
            const permissionText = requireAll ? '所有权限' : '以下权限之一';
            return res.sendUnauthorized(`权限不足，需要${permissionText}: ${permissionArray.join(', ')}`);
          }
        }

        next();
      });
    } catch (error) {
      logger.error('权限检查中间件错误:', error);
      res.status(500).json({
        success: COMMON_STATUS.FAILED,
        message: '权限验证服务异常'
      });
    }
  };
}

module.exports = {
  baseAuth,
  requireAuth,
  requireAdmin,
  requirePermissions,
  verifyToken,
  extractToken,
  getUserById
};