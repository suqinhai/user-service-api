/**
 * 审计日志中间件
 * 记录敏感操作和管理员行为，提供完整的操作审计跟踪
 */

const { logger } = require('../../common/logger');
const { AUDIT_CONFIG } = require('../config');
const crypto = require('crypto');

// 审计日志存储（内存中临时存储，实际应用中应存储到数据库）
const auditLogs = [];

/**
 * 生成操作ID
 * @returns {string} - 唯一操作ID
 */
function generateOperationId() {
  return crypto.randomUUID();
}

/**
 * 判断是否为敏感操作
 * @param {Object} req - 请求对象
 * @param {string} operationType - 操作类型
 * @returns {boolean} - 是否为敏感操作
 */
function isSensitiveOperation(req, operationType) {
  if (operationType && AUDIT_CONFIG.sensitiveOperations.includes(operationType)) {
    return true;
  }
  
  // 根据请求路径和方法判断
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();
  
  // 敏感路径模式
  const sensitivePatterns = [
    /\/admin\//,
    /\/users\/\d+\/delete/,
    /\/users\/\d+\/role/,
    /\/system\/config/,
    /\/permissions/,
    /\/export/,
    /\/backup/,
    /\/restore/
  ];
  
  // 敏感操作组合
  const sensitiveOperations = [
    { method: 'DELETE', pattern: /\/users\// },
    { method: 'PUT', pattern: /\/users\/\d+\/status/ },
    { method: 'POST', pattern: /\/admin\// },
    { method: 'PUT', pattern: /\/admin\// },
    { method: 'DELETE', pattern: /\/admin\// }
  ];
  
  // 检查敏感路径
  if (sensitivePatterns.some(pattern => pattern.test(path))) {
    return true;
  }
  
  // 检查敏感操作组合
  if (sensitiveOperations.some(op => op.method === method && op.pattern.test(path))) {
    return true;
  }
  
  return false;
}

/**
 * 提取请求关键信息
 * @param {Object} req - 请求对象
 * @returns {Object} - 请求关键信息
 */
function extractRequestInfo(req) {
  return {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: req.query,
    params: req.params,
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
      'x-forwarded-for': req.get('X-Forwarded-For')
    },
    ip: req.ip,
    apiType: req.apiType
  };
}

/**
 * 提取响应关键信息
 * @param {Object} res - 响应对象
 * @param {*} responseData - 响应数据
 * @returns {Object} - 响应关键信息
 */
function extractResponseInfo(res, responseData) {
  return {
    statusCode: res.statusCode,
    headers: {
      'content-type': res.get('Content-Type'),
      'content-length': res.get('Content-Length')
    },
    // 只在配置允许时记录响应体
    body: AUDIT_CONFIG.logResponseBody ? responseData : undefined
  };
}

/**
 * 创建审计日志记录
 * @param {Object} options - 审计选项
 * @returns {Object} - 审计日志记录
 */
function createAuditLog(options) {
  const {
    operationId,
    operationType,
    userId,
    userRole,
    request,
    response,
    duration,
    success,
    error,
    metadata
  } = options;
  
  return {
    operationId,
    operationType,
    user: {
      id: userId,
      role: userRole
    },
    request,
    response,
    timing: {
      timestamp: new Date().toISOString(),
      duration
    },
    result: {
      success,
      error: error ? {
        message: error.message,
        type: error.name,
        code: error.code
      } : undefined
    },
    metadata: metadata || {}
  };
}

/**
 * 保存审计日志
 * @param {Object} auditLog - 审计日志记录
 */
async function saveAuditLog(auditLog) {
  try {
    // 添加到内存存储（实际应用中应保存到数据库）
    auditLogs.push(auditLog);
    
    // 保持最近1000条记录
    if (auditLogs.length > 1000) {
      auditLogs.shift();
    }
    
    // 记录到日志系统
    logger.security('审计日志', auditLog);
    
    // TODO: 这里应该保存到数据库
    // await AuditLogModel.create(auditLog);
    
  } catch (error) {
    logger.error('保存审计日志失败', error);
  }
}

/**
 * 基础审计中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
const basicAudit = (req, res, next) => {
  if (!AUDIT_CONFIG.enabled) {
    return next();
  }
  
  const startTime = Date.now();
  const operationId = generateOperationId();
  
  // 将操作ID添加到请求对象
  req.operationId = operationId;
  
  // 提取请求信息
  const requestInfo = extractRequestInfo(req);
  
  // 如果配置允许，记录请求体
  if (AUDIT_CONFIG.logRequestBody && req.body) {
    requestInfo.body = req.body;
  }
  
  // 拦截响应
  const originalSend = res.send;
  const originalJson = res.json;
  
  const interceptResponse = (data) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 提取响应信息
    const responseInfo = extractResponseInfo(res, data);
    
    // 创建基础审计日志
    const auditLog = createAuditLog({
      operationId,
      operationType: 'API_REQUEST',
      userId: req.user?.id,
      userRole: req.user?.role,
      request: requestInfo,
      response: responseInfo,
      duration,
      success: res.statusCode < 400,
      error: res.statusCode >= 400 ? { message: '请求失败', code: res.statusCode } : undefined
    });
    
    // 异步保存审计日志
    saveAuditLog(auditLog).catch(error => {
      logger.error('异步保存审计日志失败', error);
    });
  };
  
  res.send = function(data) {
    interceptResponse(data);
    originalSend.call(this, data);
  };
  
  res.json = function(data) {
    interceptResponse(data);
    originalJson.call(this, data);
  };
  
  next();
};

/**
 * 敏感操作审计中间件
 * @param {string} operationType - 操作类型
 * @param {Object} options - 审计选项
 * @returns {Function} - 中间件函数
 */
const sensitiveOperationAudit = (operationType, options = {}) => {
  return (req, res, next) => {
    if (!AUDIT_CONFIG.enabled) {
      return next();
    }
    
    const startTime = Date.now();
    const operationId = req.operationId || generateOperationId();
    
    // 检查是否为敏感操作
    if (!isSensitiveOperation(req, operationType)) {
      return next();
    }
    
    // 记录操作开始
    logger.security('敏感操作开始', {
      operationId,
      operationType,
      userId: req.user?.id,
      userRole: req.user?.role,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    // 提取详细的请求信息
    const requestInfo = {
      ...extractRequestInfo(req),
      body: req.body, // 敏感操作总是记录请求体
      timestamp: new Date().toISOString()
    };
    
    // 拦截响应
    const originalSend = res.send;
    const originalJson = res.json;
    
    const interceptSensitiveResponse = async (data) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const responseInfo = extractResponseInfo(res, data);
      const success = res.statusCode < 400;
      
      // 创建详细的敏感操作审计日志
      const auditLog = createAuditLog({
        operationId,
        operationType,
        userId: req.user?.id,
        userRole: req.user?.role,
        request: requestInfo,
        response: responseInfo,
        duration,
        success,
        error: !success ? { message: '操作失败', code: res.statusCode } : undefined,
        metadata: {
          ...options.metadata,
          sensitive: true,
          riskLevel: options.riskLevel || 'medium'
        }
      });
      
      // 保存审计日志
      await saveAuditLog(auditLog);
      
      // 记录操作完成
      logger.security('敏感操作完成', {
        operationId,
        operationType,
        success,
        duration,
        statusCode: res.statusCode
      });
    };
    
    res.send = function(data) {
      interceptSensitiveResponse(data);
      originalSend.call(this, data);
    };
    
    res.json = function(data) {
      interceptSensitiveResponse(data);
      originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * 管理员操作审计中间件
 */
const adminOperationAudit = sensitiveOperationAudit('ADMIN_OPERATION', {
  riskLevel: 'high',
  metadata: { category: 'admin' }
});

/**
 * 用户数据操作审计中间件
 */
const userDataAudit = sensitiveOperationAudit('USER_DATA_OPERATION', {
  riskLevel: 'medium',
  metadata: { category: 'user_data' }
});

/**
 * 获取审计日志
 * @param {Object} filters - 过滤条件
 * @returns {Array} - 审计日志列表
 */
const getAuditLogs = (filters = {}) => {
  let logs = [...auditLogs];
  
  // 应用过滤条件
  if (filters.userId) {
    logs = logs.filter(log => log.user.id === filters.userId);
  }
  
  if (filters.operationType) {
    logs = logs.filter(log => log.operationType === filters.operationType);
  }
  
  if (filters.startDate) {
    logs = logs.filter(log => new Date(log.timing.timestamp) >= new Date(filters.startDate));
  }
  
  if (filters.endDate) {
    logs = logs.filter(log => new Date(log.timing.timestamp) <= new Date(filters.endDate));
  }
  
  // 按时间倒序排列
  return logs.sort((a, b) => new Date(b.timing.timestamp) - new Date(a.timing.timestamp));
};

/**
 * 清理过期审计日志
 */
const cleanupExpiredLogs = () => {
  const retentionTime = AUDIT_CONFIG.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - retentionTime;
  
  const initialCount = auditLogs.length;
  
  // 移除过期日志
  for (let i = auditLogs.length - 1; i >= 0; i--) {
    if (new Date(auditLogs[i].timing.timestamp).getTime() < cutoffTime) {
      auditLogs.splice(i, 1);
    }
  }
  
  const removedCount = initialCount - auditLogs.length;
  if (removedCount > 0) {
    logger.info(`清理了 ${removedCount} 条过期审计日志`);
  }
};

// 定期清理过期日志
setInterval(cleanupExpiredLogs, 24 * 60 * 60 * 1000); // 每天清理一次

module.exports = {
  basicAudit,
  sensitiveOperationAudit,
  adminOperationAudit,
  userDataAudit,
  getAuditLogs,
  cleanupExpiredLogs,
  generateOperationId,
  isSensitiveOperation
};
