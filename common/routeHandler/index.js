/**
 * 路由处理函数包装器
 * 用于封装路由处理函数中的 try-catch 逻辑
 */

// 引入i18next以便访问翻译功能
const { getI18n } = require('../i18n');

/**
 * 异步路由处理函数包装器
 * @param {Function} handler - 路由处理函数
 * @returns {Function} - 包装后的路由处理函数
 */
const asyncHandler = (handler) => {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        console.error(`路由错误: ${error.message}`, error.stack, error.original || '');
        const i18n = getI18n();
        res.status(500).json({
          code: 500,
          message: `${i18n.t('操作失败')}: ${error.message || 'Undetailed error'}`
        });
      }
    };
  };

/**
 * 翻译消息文本
 * @param {Object} req - Express 请求对象
 * @param {String} message - 消息文本或翻译键
 * @param {Object} options - 翻译选项
 * @returns {String} 翻译后的文本
 */
const translateMessage = (message, options = {}) => {
  // 获取i18next实例
  const i18n = getI18n();
  
  // 如果消息是字符串且长度合理，尝试翻译
  if (typeof message === 'string') {
    // 直接尝试翻译，无论是中文键还是点号格式的旧键
    return i18n.t(message, options);
  }
  
  // 如果不是翻译键或翻译失败，返回原始消息
  return message;
};

/**
 * 发送响应
 * @param {Object} res - Express 响应对象
 * @param {Number} status - HTTP状态码
 * @param {Boolean} success - 是否成功
 * @param {String} message - 响应消息或翻译键
 * @param {Object} data - 响应数据
 * @returns {Object} Express 响应
 */
const sendResponse = (res, status, success, message, data = null) => {
  // 翻译消息
  const translatedMessage = translateMessage(message,data);
  
  const responseBody = {
    success,
    message: translatedMessage
  };

  if (data) {
    responseBody.data = data;
  }

  return res.status(status).json(responseBody);
};

/**
 * 发送错误响应
 * @param {Object} res - Express 响应对象
 * @param {Number} status - HTTP状态码 (默认: 400)
 * @param {String} message - 错误消息或翻译键
 * @param {Object} data - 附加数据
 * @returns {Object} Express 响应
 */
const sendError = (res, status = 400, message = '操作失败', data = null) => {
  return sendResponse(res, status, false, message, data);
};

/**
 * 发送成功响应
 * @param {Object} res - Express 响应对象
 * @param {String} message - 成功消息或翻译键
 * @param {Object} data - 响应数据
 * @returns {Object} Express 响应
 */
const sendSuccess = (res, message = '操作成功', data = null) => {
  return sendResponse(res, 200, true, message, data);
};

/**
 * 发送参数错误响应
 * @param {Object} res - Express 响应对象
 * @param {String} message - 错误消息或翻译键
 * @returns {Object} Express 响应
 */
const sendBadRequest = (res, message = '参数错误', options = {}) => {
  return sendError(res, 400, message, options);
};

/**
 * 发送未授权响应
 * @param {Object} res - Express 响应对象
 * @param {String} message - 错误消息或翻译键
 * @returns {Object} Express 响应
 */
const sendUnauthorized = (res, message = '未授权访问', options = {}) => {
  return sendError(res, 401, message, options);
};

module.exports = {
  asyncHandler,
  sendResponse,
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
};