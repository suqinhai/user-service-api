/**
 * 基础控制器类
 * 功能：提供所有控制器的通用功能和方法，实现代码复用和统一规范
 * 设计模式：模板方法模式，定义控制器的基本结构和通用操作
 * 继承：所有业务控制器都应该继承此类以获得统一的功能
 */

// 引入日志模块，用于记录控制器操作和错误信息
const { logger } = require('../../../common/logger');
const { COMMON_STATUS } = require('../../../common/constants/status');

class BaseController {
  /**
   * 构造函数：初始化基础控制器
   * 设置日志器实例，供子类使用
   */
  constructor() {
    // 将日志器实例赋值给实例属性，便于子类访问
    this.logger = logger;
  }

  /**
   * 异步方法包装器：自动处理异步控制器方法中的错误
   * 功能：将异步函数包装为Express中间件，自动捕获Promise异常
   * @param {Function} fn - 需要包装的异步函数
   * @returns {Function} 包装后的Express中间件函数
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      // 使用Promise.resolve确保函数返回Promise，然后捕获任何异常
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * 统一成功响应方法：返回标准化的成功响应格式
   * 功能：确保所有成功响应具有一致的数据结构
   * @param {Object} res - Express响应对象
   * @param {string} message - 成功消息，默认为'操作成功'
   * @param {Object} data - 响应数据，可选
   * @param {number} statusCode - HTTP状态码，默认为200
   */
  sendSuccess(res, message = '操作成功', data = null, statusCode = 200) {
    // 构建标准成功响应对象
    const response = {
      success: COMMON_STATUS.SUCCESS,      // 成功标识
      message,                             // 操作消息
      // timestamp: new Date().toISOString()  // 响应时间戳
    };

    // 只有当data不为null时才添加data字段，避免不必要的null值
    if (data !== null) {
      response.data = data;
    }

    // 返回JSON响应
    return res.status(statusCode).json(response);
  }

  /**
   * 统一错误响应方法：返回标准化的错误响应格式
   * 功能：确保所有错误响应具有一致的数据结构
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息，默认为'操作失败'
   * @param {number} statusCode - HTTP状态码，默认为400
   * @param {Array} errors - 详细错误信息数组，可选
   */
  sendError(res, message = '操作失败', statusCode = 400, errors = null) {
    // 构建标准错误响应对象
    const response = {
      success: COMMON_STATUS.FAILED,       // 失败标识
      message,                             // 错误消息
      timestamp: new Date().toISOString()  // 响应时间戳
    };

    // 如果有详细错误信息，则添加到响应中（用于表单验证等场景）
    if (errors) {
      response.errors = errors;
    }

    // 返回JSON错误响应
    return res.status(statusCode).json(response);
  }

  /**
   * 分页响应方法：返回带分页信息的数据响应
   * 功能：统一处理列表数据的分页响应格式
   * @param {Object} res - Express响应对象
   * @param {Array} data - 数据列表
   * @param {Object} pagination - 分页信息对象
   * @param {string} message - 响应消息，默认为'获取数据成功'
   */
  sendPaginatedResponse(res, data, pagination, message = '获取数据成功') {
    // 调用成功响应方法，传入包含分页信息的数据结构
    return this.sendSuccess(res, message, {
      items: data,             // 数据列表
      pagination: {
        page: pagination.page,                                           // 当前页码
        limit: pagination.limit,                                         // 每页数量
        total: pagination.total,                                         // 总记录数
        totalPages: Math.ceil(pagination.total / pagination.limit),     // 总页数
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit) ? COMMON_STATUS.YES : COMMON_STATUS.NO,  // 是否有下一页
        hasPrev: pagination.page > 1 ? COMMON_STATUS.YES : COMMON_STATUS.NO                                     // 是否有上一页
      }
    });
  }

  /**
   * 请求参数验证方法：验证必需字段是否存在
   * 功能：统一处理请求参数的必填字段验证
   * @param {Object} req - Express请求对象
   * @param {Array} requiredFields - 必需字段名称数组
   * @returns {Object|null} 验证错误数组或null（无错误）
   */
  validateRequiredFields(req, requiredFields) {
    const errors = [];
    // 合并请求体、查询参数和路径参数中的所有数据
    const data = { ...req.body, ...req.query, ...req.params };

    // 遍历所有必需字段，检查是否存在且不为空
    requiredFields.forEach(field => {
      if (!data[field] || data[field] === '') {
        errors.push({
          field,                           // 字段名
          message: `${field} 是必需的`     // 错误消息
        });
      }
    });

    // 如果有错误则返回错误数组，否则返回null
    return errors.length > 0 ? errors : null;
  }

  /**
   * 获取分页参数方法：从请求中提取并验证分页参数
   * 功能：统一处理分页参数的提取和边界值验证
   * @param {Object} req - Express请求对象
   * @param {number} defaultLimit - 默认每页数量，默认为20
   * @returns {Object} 包含page、limit、offset的分页参数对象
   */
  getPaginationParams(req, defaultLimit = 20) {
    // 页码：最小为1，如果无效则使用1
    const page = Math.max(1, parseInt(req.query.page) || 1);
    // 每页数量：最小为1，最大为100，如果无效则使用默认值
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || defaultLimit));
    // 计算数据库查询的偏移量
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * 获取排序参数方法：从请求中提取并验证排序参数
   * 功能：统一处理数据排序参数的提取和验证
   * @param {Object} req - Express请求对象
   * @param {string} defaultSort - 默认排序字段，默认为'created_at'
   * @param {string} defaultOrder - 默认排序方向，默认为'DESC'
   * @returns {Object} 包含sortBy和sortOrder的排序参数对象
   */
  getSortParams(req, defaultSort = 'created_at', defaultOrder = 'DESC') {
    // 排序字段：使用请求参数或默认值
    const sortBy = req.query.sortBy || defaultSort;
    // 排序方向：转换为大写并验证有效性
    const sortOrder = (req.query.sortOrder || defaultOrder).toUpperCase();

    return {
      sortBy,
      // 确保排序方向只能是ASC或DESC，无效时使用DESC
      sortOrder: ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC'
    };
  }

  /**
   * 记录操作日志方法：记录控制器中的重要操作
   * 功能：统一记录用户操作，便于审计和问题追踪
   * @param {string} action - 操作类型描述
   * @param {Object} req - Express请求对象
   * @param {Object} details - 额外的详细信息，默认为空对象
   */
  logAction(action, req, details = {}) {
    // 使用info级别记录操作日志，包含用户和请求信息
    this.logger.info(`控制器操作: ${action}`, {
      action,                              // 操作类型
      userId: req.user?.id,               // 操作用户ID（如果已认证）
      ip: req.ip,                         // 客户端IP地址
      userAgent: req.get('User-Agent'),   // 用户代理字符串
      url: req.originalUrl,               // 请求URL
      method: req.method,                 // HTTP方法
      ...details                          // 额外的详细信息
    });
  }

  /**
   * 记录错误日志方法：记录控制器中发生的错误
   * 功能：统一记录错误信息，便于问题诊断和修复
   * @param {string} action - 发生错误的操作类型
   * @param {Error} error - 错误对象
   * @param {Object} req - Express请求对象
   */
  logError(action, error, req) {
    // 使用error级别记录错误日志，包含错误堆栈和请求信息
    this.logger.error(`控制器错误: ${action}`, {
      action,                    // 操作类型
      error: error.message,      // 错误消息
      stack: error.stack,        // 错误堆栈
      userId: req.user?.id,      // 操作用户ID（如果已认证）
      ip: req.ip,                // 客户端IP地址
      url: req.originalUrl,      // 请求URL
      method: req.method         // HTTP方法
    });
  }
}

// 导出基础控制器类，供其他控制器继承使用
module.exports = BaseController;
