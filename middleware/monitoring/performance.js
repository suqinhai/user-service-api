/**
 * 性能监控中间件
 * 监控API响应时间、内存使用、请求统计等性能指标
 */

const { logger } = require('../../common/logger');
const { PERFORMANCE_CONFIG } = require('../config');
const os = require('os');

// 性能统计数据存储
const performanceStats = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byMethod: {},
    byRoute: {},
    byStatusCode: {},
    byApiType: {}
  },
  responseTime: {
    total: 0,
    count: 0,
    min: Infinity,
    max: 0,
    avg: 0,
    recent: [], // 最近的响应时间记录
    percentiles: {
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0
    }
  },
  memory: {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0,
    lastCheck: Date.now()
  },
  system: {
    cpuUsage: 0,
    loadAverage: [],
    uptime: 0,
    lastCheck: Date.now()
  },
  errors: {
    total: 0,
    byType: {},
    recent: []
  },
  slowRequests: []
};

/**
 * 更新响应时间统计
 * @param {number} responseTime - 响应时间（毫秒）
 */
function updateResponseTimeStats(responseTime) {
  const stats = performanceStats.responseTime;
  
  stats.total += responseTime;
  stats.count++;
  stats.min = Math.min(stats.min, responseTime);
  stats.max = Math.max(stats.max, responseTime);
  stats.avg = stats.total / stats.count;
  
  // 保持最近1000个响应时间记录用于计算百分位数
  stats.recent.push(responseTime);
  if (stats.recent.length > 1000) {
    stats.recent.shift();
  }
  
  // 计算百分位数
  if (stats.recent.length > 0) {
    const sorted = [...stats.recent].sort((a, b) => a - b);
    const len = sorted.length;
    
    stats.percentiles.p50 = sorted[Math.floor(len * 0.5)];
    stats.percentiles.p90 = sorted[Math.floor(len * 0.9)];
    stats.percentiles.p95 = sorted[Math.floor(len * 0.95)];
    stats.percentiles.p99 = sorted[Math.floor(len * 0.99)];
  }
}

/**
 * 更新内存统计
 */
function updateMemoryStats() {
  const memUsage = process.memoryUsage();
  const stats = performanceStats.memory;
  
  stats.heapUsed = memUsage.heapUsed;
  stats.heapTotal = memUsage.heapTotal;
  stats.external = memUsage.external;
  stats.rss = memUsage.rss;
  stats.lastCheck = Date.now();
  
  // 检查内存使用警告
  if (stats.heapUsed > PERFORMANCE_CONFIG.memoryThreshold.warning) {
    const level = stats.heapUsed > PERFORMANCE_CONFIG.memoryThreshold.critical ? 'critical' : 'warning';
    logger.warn(`内存使用${level}警告`, {
      heapUsed: Math.round(stats.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(stats.heapTotal / 1024 / 1024) + 'MB',
      threshold: Math.round(PERFORMANCE_CONFIG.memoryThreshold[level] / 1024 / 1024) + 'MB'
    });
  }
}

/**
 * 更新系统统计
 */
function updateSystemStats() {
  const stats = performanceStats.system;
  
  stats.cpuUsage = process.cpuUsage();
  stats.loadAverage = os.loadavg();
  stats.uptime = process.uptime();
  stats.lastCheck = Date.now();
}

/**
 * 记录慢请求
 * @param {Object} requestInfo - 请求信息
 */
function recordSlowRequest(requestInfo) {
  performanceStats.slowRequests.push({
    ...requestInfo,
    timestamp: Date.now()
  });
  
  // 只保留最近100个慢请求记录
  if (performanceStats.slowRequests.length > 100) {
    performanceStats.slowRequests.shift();
  }
}

/**
 * 记录错误统计
 * @param {Error} error - 错误对象
 * @param {Object} req - 请求对象
 */
function recordError(error, req) {
  const stats = performanceStats.errors;
  
  stats.total++;
  
  const errorType = error.errorType || error.name || 'Unknown';
  stats.byType[errorType] = (stats.byType[errorType] || 0) + 1;
  
  // 记录最近的错误
  stats.recent.push({
    type: errorType,
    message: error.message,
    path: req.path,
    method: req.method,
    timestamp: Date.now()
  });
  
  // 只保留最近50个错误记录
  if (stats.recent.length > 50) {
    stats.recent.shift();
  }
}

/**
 * 性能监控中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
const performanceMonitor = (req, res, next) => {
  if (!PERFORMANCE_CONFIG.enabled) {
    return next();
  }
  
  const startTime = Date.now();
  const startHrTime = process.hrtime();
  
  // 记录请求开始
  const requestInfo = {
    method: req.method,
    path: req.path,
    route: req.route?.path || req.path,
    apiType: req.apiType || 'unknown',
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  };
  
  // 拦截响应结束事件
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const hrResponseTime = process.hrtime(startHrTime);
    const responseTimeMs = hrResponseTime[0] * 1000 + hrResponseTime[1] / 1000000;
    
    // 更新请求统计
    const stats = performanceStats.requests;
    stats.total++;
    
    if (res.statusCode < 400) {
      stats.success++;
    } else {
      stats.error++;
    }
    
    // 按方法统计
    stats.byMethod[req.method] = (stats.byMethod[req.method] || 0) + 1;
    
    // 按路由统计
    const route = requestInfo.route;
    stats.byRoute[route] = (stats.byRoute[route] || 0) + 1;
    
    // 按状态码统计
    stats.byStatusCode[res.statusCode] = (stats.byStatusCode[res.statusCode] || 0) + 1;
    
    // 按API类型统计
    if (requestInfo.apiType) {
      stats.byApiType[requestInfo.apiType] = (stats.byApiType[requestInfo.apiType] || 0) + 1;
    }
    
    // 更新响应时间统计
    updateResponseTimeStats(responseTimeMs);
    
    // 检查是否为慢请求
    if (responseTimeMs > PERFORMANCE_CONFIG.slowRequestThreshold) {
      const slowRequestInfo = {
        ...requestInfo,
        responseTime: responseTimeMs,
        statusCode: res.statusCode
      };
      
      recordSlowRequest(slowRequestInfo);
      
      logger.warn('慢请求检测', {
        ...slowRequestInfo,
        threshold: PERFORMANCE_CONFIG.slowRequestThreshold
      });
    }
    
    // 记录请求详情（开发环境）
    // if (PERFORMANCE_CONFIG.logRequestDetails) {
    //   logger.debug('请求完成', {
    //     ...requestInfo,
    //     responseTime: responseTimeMs,
    //     statusCode: res.statusCode,
    //     contentLength: res.get('Content-Length')
    //   });
    // }
    
    // 定期更新系统统计
    const now = Date.now();
    if (now - performanceStats.memory.lastCheck > 30000) { // 每30秒更新一次
      updateMemoryStats();
      updateSystemStats();
    }
  });
  
  // 拦截错误
  const originalNext = next;
  next = (error) => {
    if (error) {
      recordError(error, req);
    }
    originalNext(error);
  };
  
  next();
};

/**
 * 获取性能统计数据
 * @returns {Object} - 性能统计数据
 */
const getPerformanceStats = () => {
  // 确保获取最新的内存和系统统计
  updateMemoryStats();
  updateSystemStats();
  
  return {
    ...performanceStats,
    timestamp: Date.now(),
    uptime: process.uptime()
  };
};

/**
 * 重置性能统计数据
 */
const resetPerformanceStats = () => {
  performanceStats.requests = {
    total: 0,
    success: 0,
    error: 0,
    byMethod: {},
    byRoute: {},
    byStatusCode: {},
    byApiType: {}
  };
  
  performanceStats.responseTime = {
    total: 0,
    count: 0,
    min: Infinity,
    max: 0,
    avg: 0,
    recent: [],
    percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
  };
  
  performanceStats.errors = {
    total: 0,
    byType: {},
    recent: []
  };
  
  performanceStats.slowRequests = [];
  
  logger.info('性能统计数据已重置');
};

/**
 * 性能报告生成器
 * @returns {Object} - 性能报告
 */
const generatePerformanceReport = () => {
  const stats = getPerformanceStats();
  const uptime = process.uptime();
  
  return {
    summary: {
      uptime: Math.round(uptime),
      totalRequests: stats.requests.total,
      successRate: stats.requests.total > 0 ? 
        ((stats.requests.success / stats.requests.total) * 100).toFixed(2) + '%' : '0%',
      averageResponseTime: Math.round(stats.responseTime.avg) + 'ms',
      slowRequestsCount: stats.slowRequests.length,
      errorsCount: stats.errors.total
    },
    responseTime: {
      average: Math.round(stats.responseTime.avg) + 'ms',
      min: Math.round(stats.responseTime.min) + 'ms',
      max: Math.round(stats.responseTime.max) + 'ms',
      percentiles: {
        p50: Math.round(stats.responseTime.percentiles.p50) + 'ms',
        p90: Math.round(stats.responseTime.percentiles.p90) + 'ms',
        p95: Math.round(stats.responseTime.percentiles.p95) + 'ms',
        p99: Math.round(stats.responseTime.percentiles.p99) + 'ms'
      }
    },
    memory: {
      heapUsed: Math.round(stats.memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(stats.memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(stats.memory.rss / 1024 / 1024) + 'MB'
    },
    requests: stats.requests,
    topSlowRequests: stats.slowRequests
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 10),
    recentErrors: stats.errors.recent.slice(-10)
  };
};

module.exports = {
  performanceMonitor,
  getPerformanceStats,
  resetPerformanceStats,
  generatePerformanceReport,
  recordError
};
