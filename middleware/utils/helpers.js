/**
 * 中间件辅助函数
 * 提供中间件开发和使用中的通用工具函数
 */

const { logger } = require('../../common/logger');

/**
 * 中间件组合器
 * 将多个中间件组合成一个中间件函数
 * @param {...Function} middlewares - 中间件函数列表
 * @returns {Function} 组合后的中间件函数
 */
function composeMiddlewares(...middlewares) {
  return (req, res, next) => {
    let index = 0;
    
    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      
      index = i;
      let fn = middlewares[i];
      
      if (i === middlewares.length) {
        fn = next;
      }
      
      if (!fn) {
        return;
      }
      
      try {
        return Promise.resolve(fn(req, res, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    
    return dispatch(0);
  };
}

/**
 * 条件中间件
 * 根据条件决定是否执行中间件
 * @param {Function} condition - 条件函数，接收(req, res)参数
 * @param {Function} middleware - 要条件执行的中间件
 * @param {Function} [elseMiddleware] - 条件不满足时执行的中间件
 * @returns {Function} 条件中间件函数
 */
function conditionalMiddleware(condition, middleware, elseMiddleware) {
  return (req, res, next) => {
    try {
      const shouldExecute = condition(req, res);
      
      if (shouldExecute) {
        return middleware(req, res, next);
      } else if (elseMiddleware) {
        return elseMiddleware(req, res, next);
      } else {
        return next();
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 异步中间件包装器
 * 自动处理异步中间件中的错误
 * @param {Function} asyncMiddleware - 异步中间件函数
 * @returns {Function} 包装后的中间件函数
 */
function asyncMiddleware(asyncMiddleware) {
  return (req, res, next) => {
    Promise.resolve(asyncMiddleware(req, res, next)).catch(next);
  };
}

/**
 * 中间件执行时间测量器
 * 测量中间件的执行时间
 * @param {Function} middleware - 要测量的中间件
 * @param {string} [name] - 中间件名称
 * @returns {Function} 包装后的中间件函数
 */
function timeMiddleware(middleware, name = 'anonymous') {
  return (req, res, next) => {
    const startTime = process.hrtime();
    
    const originalNext = next;
    next = (...args) => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000; // 转换为毫秒
      
      logger.debug(`中间件 ${name} 执行时间: ${duration.toFixed(2)}ms`);
      
      originalNext(...args);
    };
    
    middleware(req, res, next);
  };
}

/**
 * 中间件错误边界
 * 为中间件提供错误边界，防止未处理的错误导致应用崩溃
 * @param {Function} middleware - 要保护的中间件
 * @param {Object} options - 选项配置
 * @returns {Function} 包装后的中间件函数
 */
function errorBoundary(middleware, options = {}) {
  const { 
    fallbackResponse = { success: false, message: '服务暂时不可用' },
    logError = true,
    statusCode = 500
  } = options;
  
  return (req, res, next) => {
    try {
      const result = middleware(req, res, (error) => {
        if (error) {
          if (logError) {
            logger.error('中间件错误边界捕获错误:', error);
          }
          
          if (!res.headersSent) {
            return res.status(statusCode).json(fallbackResponse);
          }
        }
        next(error);
      });
      
      // 处理返回Promise的中间件
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          if (logError) {
            logger.error('中间件错误边界捕获异步错误:', error);
          }
          
          if (!res.headersSent) {
            res.status(statusCode).json(fallbackResponse);
          }
        });
      }
    } catch (error) {
      if (logError) {
        logger.error('中间件错误边界捕获同步错误:', error);
      }
      
      if (!res.headersSent) {
        res.status(statusCode).json(fallbackResponse);
      }
    }
  };
}

/**
 * 中间件跳过器
 * 根据条件跳过中间件执行
 * @param {Function} condition - 跳过条件函数
 * @param {Function} middleware - 要跳过的中间件
 * @returns {Function} 包装后的中间件函数
 */
function skipMiddleware(condition, middleware) {
  return (req, res, next) => {
    if (condition(req, res)) {
      return next();
    }
    return middleware(req, res, next);
  };
}

/**
 * 中间件重试器
 * 为中间件提供重试机制
 * @param {Function} middleware - 要重试的中间件
 * @param {Object} options - 重试选项
 * @returns {Function} 包装后的中间件函数
 */
function retryMiddleware(middleware, options = {}) {
  const { 
    maxRetries = 3, 
    delay = 1000, 
    shouldRetry = () => true 
  } = options;
  
  return async (req, res, next) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          middleware(req, res, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        
        return next(); // 成功执行，退出重试循环
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !shouldRetry(error, attempt)) {
          break;
        }
        
        // 等待后重试
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        logger.warn(`中间件重试 ${attempt + 1}/${maxRetries}:`, error.message);
      }
    }
    
    // 所有重试都失败了
    next(lastError);
  };
}

/**
 * 中间件缓存器
 * 为中间件结果提供缓存
 * @param {Function} middleware - 要缓存的中间件
 * @param {Object} options - 缓存选项
 * @returns {Function} 包装后的中间件函数
 */
function cacheMiddleware(middleware, options = {}) {
  const { 
    keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
    ttl = 300000, // 5分钟
    storage = new Map()
  } = options;
  
  return (req, res, next) => {
    const cacheKey = keyGenerator(req);
    const cached = storage.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      // 缓存命中
      req.cached = cached.data;
      return next();
    }
    
    // 拦截响应以缓存结果
    const originalSend = res.send;
    const originalJson = res.json;
    
    const cacheResponse = (data) => {
      if (res.statusCode < 400) { // 只缓存成功响应
        storage.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
    };
    
    res.send = function(data) {
      cacheResponse(data);
      originalSend.call(this, data);
    };
    
    res.json = function(data) {
      cacheResponse(data);
      originalJson.call(this, data);
    };
    
    middleware(req, res, next);
  };
}

/**
 * 中间件链构建器
 * 提供流畅的API来构建中间件链
 */
class MiddlewareChain {
  constructor() {
    this.middlewares = [];
  }
  
  /**
   * 添加中间件
   * @param {Function} middleware - 中间件函数
   * @returns {MiddlewareChain} 链式调用
   */
  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }
  
  /**
   * 条件添加中间件
   * @param {Function} condition - 条件函数
   * @param {Function} middleware - 中间件函数
   * @returns {MiddlewareChain} 链式调用
   */
  useIf(condition, middleware) {
    this.middlewares.push(conditionalMiddleware(condition, middleware));
    return this;
  }
  
  /**
   * 添加异步中间件
   * @param {Function} asyncMiddleware - 异步中间件函数
   * @returns {MiddlewareChain} 链式调用
   */
  useAsync(asyncMiddleware) {
    this.middlewares.push(asyncMiddleware(asyncMiddleware));
    return this;
  }
  
  /**
   * 添加带错误边界的中间件
   * @param {Function} middleware - 中间件函数
   * @param {Object} options - 错误边界选项
   * @returns {MiddlewareChain} 链式调用
   */
  useSafe(middleware, options) {
    this.middlewares.push(errorBoundary(middleware, options));
    return this;
  }
  
  /**
   * 构建最终的中间件函数
   * @returns {Function} 组合后的中间件函数
   */
  build() {
    return composeMiddlewares(...this.middlewares);
  }
  
  /**
   * 获取中间件数组
   * @returns {Array} 中间件数组
   */
  toArray() {
    return [...this.middlewares];
  }
}

/**
 * 创建中间件链
 * @returns {MiddlewareChain} 中间件链实例
 */
function createMiddlewareChain() {
  return new MiddlewareChain();
}

/**
 * 中间件性能分析器
 * 分析中间件的性能表现
 * @param {Array} middlewares - 中间件数组
 * @returns {Function} 分析中间件函数
 */
function profileMiddlewares(middlewares) {
  const stats = new Map();
  
  const profiledMiddlewares = middlewares.map((middleware, index) => {
    const name = middleware.name || `middleware_${index}`;
    
    return timeMiddleware((req, res, next) => {
      const start = process.hrtime();
      
      middleware(req, res, (error) => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        
        if (!stats.has(name)) {
          stats.set(name, { count: 0, totalTime: 0, avgTime: 0 });
        }
        
        const stat = stats.get(name);
        stat.count++;
        stat.totalTime += duration;
        stat.avgTime = stat.totalTime / stat.count;
        
        next(error);
      });
    }, name);
  });
  
  // 添加获取统计信息的方法
  profiledMiddlewares.getStats = () => Object.fromEntries(stats);
  
  return profiledMiddlewares;
}

module.exports = {
  composeMiddlewares,
  conditionalMiddleware,
  asyncMiddleware,
  timeMiddleware,
  errorBoundary,
  skipMiddleware,
  retryMiddleware,
  cacheMiddleware,
  createMiddlewareChain,
  MiddlewareChain,
  profileMiddlewares
};
