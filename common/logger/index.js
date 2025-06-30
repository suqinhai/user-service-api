/**
 * 日志记录模块
 * 提供统一的日志记录功能，用于监控应用性能和错误
 */
const winston = require('winston');
const { createLogger, format, transports } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志级别
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// 日志分类
const LOG_CATEGORIES = {
  DATABASE: 'database',
  CACHE: 'cache',
  AUTH: 'auth',
  REQUEST: 'request',
  SYSTEM: 'system'
};

// 自定义日志格式
const customFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  format.printf(info => {
    const { timestamp, level, message, category, ...rest } = info;
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] [${category || 'general'}] ${message}`;
    
    // 添加额外数据
    if (Object.keys(rest).length > 0) {
      // 处理错误对象
      if (rest.error instanceof Error) {
        const { error, ...otherData } = rest;
        logMessage += `\nError: ${error.message}\nStack: ${error.stack || '(No stack trace)'}`;
        
        // 添加其他错误属性
        const errorDetails = {};
        Object.getOwnPropertyNames(error).forEach(key => {
          if (key !== 'stack' && key !== 'message') {
            errorDetails[key] = error[key];
          }
        });
        
        if (Object.keys(errorDetails).length > 0) {
          logMessage += `\nDetails: ${JSON.stringify(errorDetails, null, 2)}`;
        }
        
        // 添加其余数据
        if (Object.keys(otherData).length > 0) {
          logMessage += `\nData: ${JSON.stringify(otherData, null, 2)}`;
        }
      } else {
        try {
          logMessage += `\nData: ${JSON.stringify(rest, null, 2)}`;
        } catch (error) {
          logMessage += `\nData: [无法序列化的数据]`;
        }
      }
    }
    
    return logMessage;
  })
);

// 创建控制台传输器
const consoleTransport = new transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  handleExceptions: true
});

// 创建日志文件传输器（按日期轮转）
const fileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-app.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  maxSize: '20m',
  maxFiles: '14d',
  format: format.combine(
    format.uncolorize()
  )
});

// 创建错误日志文件传输器（按日期轮转）
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-error.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: format.combine(
    format.uncolorize()
  )
});

// 创建数据库日志文件传输器（按日期轮转）
const dbFileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-database.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'debug',
  maxSize: '20m',
  maxFiles: '7d',
  format: format.combine(
    format.uncolorize()
  )
});

// 筛选数据库相关日志
const dbFilter = format((info) => {
  return info.category === LOG_CATEGORIES.DATABASE ? info : false;
});

// 创建Winston日志记录器实例
const logger = createLogger({
  format: customFormat,
  transports: [
    consoleTransport,
    fileTransport,
    errorFileTransport,
    new DailyRotateFile({
      filename: path.join(logDir, '%DATE%-database.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'debug',
      maxSize: '20m',
      maxFiles: '7d',
      format: format.combine(
        format.uncolorize(),
        dbFilter()
      )
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, '%DATE%-exceptions.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: format.combine(
        format.uncolorize()
      )
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, '%DATE%-rejections.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: format.combine(
        format.uncolorize()
      )
    })
  ],
  exitOnError: false
});

/**
 * 记录日志
 * @param {string} level - 日志级别
 * @param {string} category - 日志分类
 * @param {string} message - 日志消息
 * @param {Object} [data] - 附加数据
 */
function log(level, category, message, data = null) {
  logger.log({
    level,
    message,
    category,
    ...data ? (data instanceof Error ? { error: data } : data) : {}
  });
}

/**
 * 记录数据库性能日志
 * @param {string} operation - 数据库操作类型
 * @param {number} duration - 操作耗时（毫秒）
 * @param {string} query - SQL查询语句
 * @param {Object} [params] - 查询参数
 */
function logDatabasePerformance(operation, duration, query, params = null) {
  // 对耗时较长的数据库操作进行警告
  const level = duration > 500 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  
  log(level, LOG_CATEGORIES.DATABASE, `${operation} 耗时 ${duration}ms`, {
    query,
    params,
    duration
  });
}

/**
 * 记录缓存性能日志
 * @param {string} operation - 缓存操作类型
 * @param {number} duration - 操作耗时（毫秒）
 * @param {string} key - 缓存键
 * @param {boolean} hit - 是否命中缓存
 */
function logCachePerformance(operation, duration, key, hit = null) {
  // 对耗时较长的缓存操作进行警告
  const level = duration > 200 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  
  log(level, LOG_CATEGORIES.CACHE, `${operation} 耗时 ${duration}ms`, {
    key,
    hit,
    duration
  });
}

/**
 * 记录请求性能日志
 * @param {Object} req - 请求对象
 * @param {number} duration - 请求处理耗时（毫秒）
 * @param {number} statusCode - HTTP状态码
 */
function logRequestPerformance(req, duration, statusCode) {
  // 对耗时较长的请求进行警告
  const level = duration > 1000 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO;
  
  log(level, LOG_CATEGORIES.REQUEST, `${req.method} ${req.path} ${statusCode} 耗时 ${duration}ms`, {
    method: req.method,
    path: req.path,
    query: req.query,
    statusCode,
    duration,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });
}

/**
 * 记录错误日志
 * @param {string} category - 错误分类
 * @param {string} message - 错误消息
 * @param {Error|Object} error - 错误对象或附加数据
 */
function logError(category, message, error) {
  log(LOG_LEVELS.ERROR, category, message, error);
}

/**
 * 创建Express中间件，用于记录请求日志
 * @returns {Function} Express中间件函数
 */
function requestLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // 在响应结束后记录请求日志
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logRequestPerformance(req, duration, res.statusCode);
    });
    
    next();
  };
}

module.exports = {
  LOG_LEVELS,
  LOG_CATEGORIES,
  log,
  logDatabasePerformance,
  logCachePerformance,
  logRequestPerformance,
  logError,
  requestLogger,
  logger
};