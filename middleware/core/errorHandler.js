/**
 * 核心错误处理中间件
 * 提供统一的错误响应和错误日志记录，支持多种错误类型和自定义错误处理
 */

const { logger } = require('../../common/logger');
const { ERROR_CONFIG } = require('../config');

// 错误类型定义
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  DATABASE: 'DATABASE_ERROR',
  EXTERNAL_API: 'EXTERNAL_API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  CACHE: 'CACHE_ERROR',
  FILE_UPLOAD: 'FILE_UPLOAD_ERROR',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR'
};

// 错误码定义
const ERROR_CODES = {
  // 客户端错误 4xx
  VALIDATION_FAILED: 40001,
  INVALID_CREDENTIALS: 40101,
  TOKEN_EXPIRED: 40102,
  TOKEN_INVALID: 40103,
  INSUFFICIENT_PERMISSIONS: 40301,
  RESOURCE_NOT_FOUND: 40401,
  METHOD_NOT_ALLOWED: 40501,
  CONFLICT: 40901,
  RATE_LIMIT_EXCEEDED: 42901,
  
  // 服务器错误 5xx
  INTERNAL_SERVER_ERROR: 50001,
  DATABASE_CONNECTION_ERROR: 50002,
  DATABASE_QUERY_ERROR: 50003,
  EXTERNAL_SERVICE_ERROR: 50004,
  CACHE_ERROR: 50005,
  FILE_SYSTEM_ERROR: 50006,
  CONFIGURATION_ERROR: 50007
};

// 基础错误类
class AppError extends Error {
  constructor(message, statusCode, errorCode, errorType = ERROR_TYPES.INTERNAL, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errorType = errorType;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 验证错误类
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, ERROR_CODES.VALIDATION_FAILED, ERROR_TYPES.VALIDATION, details);
  }
}

// 认证错误类
class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401, ERROR_CODES.INVALID_CREDENTIALS, ERROR_TYPES.AUTHENTICATION);
  }
}

// 授权错误类
class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, ERROR_TYPES.AUTHORIZATION);
  }
}

// 资源未找到错误类
class NotFoundError extends AppError {
  constructor(message = '资源未找到') {
    super(message, 404, ERROR_CODES.RESOURCE_NOT_FOUND, ERROR_TYPES.NOT_FOUND);
  }
}

// 冲突错误类
class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409, ERROR_CODES.CONFLICT, ERROR_TYPES.BUSINESS_LOGIC);
  }
}

// 数据库错误类
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    const errorCode = originalError?.code === 'ECONNREFUSED' 
      ? ERROR_CODES.DATABASE_CONNECTION_ERROR 
      : ERROR_CODES.DATABASE_QUERY_ERROR;
    
    super(message, 500, errorCode, ERROR_TYPES.DATABASE, {
      originalError: originalError?.message,
      sqlState: originalError?.sqlState,
      errno: originalError?.errno,
      sql: originalError?.sql
    });
  }
}

// 限流错误类
class RateLimitError extends AppError {
  constructor(message = '请求过于频繁，请稍后再试') {
    super(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED, ERROR_TYPES.RATE_LIMIT);
  }
}

// 缓存错误类
class CacheError extends AppError {
  constructor(message = '缓存服务异常') {
    super(message, 500, ERROR_CODES.CACHE_ERROR, ERROR_TYPES.CACHE);
  }
}

// 文件上传错误类
class FileUploadError extends AppError {
  constructor(message = '文件上传失败') {
    super(message, 400, ERROR_CODES.VALIDATION_FAILED, ERROR_TYPES.FILE_UPLOAD);
  }
}

// 业务逻辑错误类
class BusinessLogicError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, ERROR_CODES.VALIDATION_FAILED, ERROR_TYPES.BUSINESS_LOGIC);
  }
}

/**
 * 错误分类器
 * 根据错误类型和内容对错误进行分类
 * @param {Error} err - 原始错误
 * @returns {AppError} - 分类后的错误
 */
function classifyError(err) {
  // 如果已经是AppError，直接返回
  if (err instanceof AppError) {
    return err;
  }
  
  // 根据错误名称和属性进行分类
  switch (err.name) {
    case 'ValidationError':
      return new ValidationError('数据验证失败', err.errors);
    
    case 'JsonWebTokenError':
      return new AuthenticationError('无效的访问令牌');
    
    case 'TokenExpiredError':
      return new AuthenticationError('访问令牌已过期');
    
    case 'SequelizeConnectionError':
    case 'SequelizeConnectionRefusedError':
      return new DatabaseError('数据库连接失败', err);
    
    case 'SequelizeValidationError':
      return new ValidationError('数据验证失败', err.errors);
    
    case 'SequelizeUniqueConstraintError':
      return new ConflictError('数据已存在，违反唯一性约束');
    
    case 'SequelizeForeignKeyConstraintError':
      return new ValidationError('外键约束违反');
    
    case 'MulterError':
      if (err.code === 'LIMIT_FILE_SIZE') {
        return new FileUploadError('文件大小超出限制');
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        return new FileUploadError('文件数量超出限制');
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return new FileUploadError('不支持的文件类型');
      }
      return new FileUploadError('文件上传失败');
    
    default:
      // 检查HTTP状态码
      if (err.status || err.statusCode) {
        const statusCode = err.status || err.statusCode;
        if (statusCode === 404) {
          return new NotFoundError(err.message);
        } else if (statusCode === 401) {
          return new AuthenticationError(err.message);
        } else if (statusCode === 403) {
          return new AuthorizationError(err.message);
        } else if (statusCode === 429) {
          return new RateLimitError(err.message);
        }
      }
      
      // 未知错误，转换为通用内部服务器错误
      return new AppError(
        ERROR_CONFIG.includeStack ? err.message : ERROR_CONFIG.defaultMessage,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        ERROR_TYPES.INTERNAL
      );
  }
}

/**
 * 主要错误处理中间件
 * @param {Error} err - 错误对象
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
const errorHandler = (err, req, res, next) => {
  // 分类错误
  const error = classifyError(err);
  
  // 构建错误日志信息
  const errorLog = {
    error: error.message,
    stack: ERROR_CONFIG.includeStack ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null,
    apiType: req.apiType || 'unknown',
    timestamp: error.timestamp,
    errorType: error.errorType,
    errorCode: error.errorCode,
    details: error.details
  };

  // 根据错误类型和严重程度选择日志级别
  if (error.statusCode >= 500) {
    logger.error('服务器内部错误', errorLog);
  } else if (error.statusCode >= 400) {
    logger.warn('客户端错误', errorLog);
  } else {
    logger.info('其他错误', errorLog);
  }

  // 构建错误响应
  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode,
      type: error.errorType,
      timestamp: error.timestamp
    }
  };

  // 开发环境下包含更多调试信息
  if (ERROR_CONFIG.includeStack) {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error.details;
  }

  // 验证错误包含详细信息
  if (error.details && error.errorType === ERROR_TYPES.VALIDATION) {
    errorResponse.error.validation = error.details;
  }

  // 设置响应状态码并返回错误信息
  res.status(error.statusCode).json(errorResponse);
};

/**
 * 404错误处理中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`路由 ${req.originalUrl} 未找到`);
  next(error);
};

/**
 * 异步错误包装器
 * 自动捕获异步函数中的错误并传递给错误处理中间件
 * @param {Function} fn - 异步函数
 * @returns {Function} - 包装后的函数
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 创建自定义错误处理器
 * @param {Object} options - 配置选项
 * @returns {Function} - 错误处理中间件
 */
const createErrorHandler = (options = {}) => {
  const config = { ...ERROR_CONFIG, ...options };
  
  return (err, req, res, next) => {
    const error = classifyError(err);
    
    // 自定义错误处理逻辑
    if (config.customHandler && typeof config.customHandler === 'function') {
      return config.customHandler(error, req, res, next);
    }
    
    // 使用默认错误处理
    errorHandler(err, req, res, next);
  };
};

module.exports = {
  // 错误类
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  RateLimitError,
  CacheError,
  FileUploadError,
  BusinessLogicError,
  
  // 错误常量
  ERROR_TYPES,
  ERROR_CODES,
  
  // 中间件
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createErrorHandler,
  classifyError
};
