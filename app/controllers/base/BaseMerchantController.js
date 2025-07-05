/**
 * 商户端基础控制器类
 * 功能：为商户端控制器提供通用的基础功能和商户特定的验证逻辑
 * 继承：BaseController，获得统一的响应格式和错误处理能力
 * 扩展：添加商户身份验证、数据隔离等商户端特有功能
 */

// 引入基础控制器类，提供通用的控制器功能
const BaseController = require('./BaseController');
const { MERCHANT_STATUS, COMMON_STATUS } = require('../../../common/constants/status');
const { StatusHelper } = require('../../../common/utils/statusHelper');

class BaseMerchantController extends BaseController {
  /**
   * 构造函数：初始化商户端基础控制器
   * 调用父类构造函数并设置商户端特有配置
   */
  constructor() {
    // 调用父类构造函数，获得基础功能
    super();
    
    // 商户端特有配置
    this.userType = 'merchant';
    this.requireMerchantAuth = COMMON_STATUS.YES;
  }

  /**
   * 验证商户身份
   * 确保当前用户具有商户身份
   * @param {Object} req - Express请求对象
   * @returns {Object|null} 返回验证错误信息或null（验证通过）
   */
  validateMerchantAuth(req) {
    // 检查用户是否已认证
    if (!req.user) {
      return {
        status: 401,
        message: '用户未认证',
        code: 'USER_NOT_AUTHENTICATED'
      };
    }

    // 检查用户是否具有商户身份
    if (!req.user.merchantId) {
      return {
        status: 403,
        message: '需要商户身份认证',
        code: 'MERCHANT_AUTH_REQUIRED'
      };
    }

    // 检查商户状态是否正常
    if (req.user.merchantStatus !== undefined && !StatusHelper.isMerchantActive(req.user.merchantStatus)) {
      return {
        status: 403,
        message: '商户账户状态异常，请联系管理员',
        code: 'MERCHANT_STATUS_ABNORMAL'
      };
    }

    return null; // 验证通过
  }

  /**
   * 验证店铺访问权限
   * 确保商户只能访问自己的店铺数据
   * @param {Object} req - Express请求对象
   * @param {number} shopId - 店铺ID
   * @returns {Object|null} 返回验证错误信息或null（验证通过）
   */
  validateShopAccess(req, shopId) {
    // 先验证商户身份
    const merchantAuthError = this.validateMerchantAuth(req);
    if (merchantAuthError) {
      return merchantAuthError;
    }

    // 检查店铺ID是否提供
    if (!shopId) {
      return {
        status: 400,
        message: '店铺ID不能为空',
        code: 'SHOP_ID_REQUIRED'
      };
    }

    // 检查商户是否有权访问该店铺
    if (req.user.shopIds && !req.user.shopIds.includes(parseInt(shopId))) {
      return {
        status: 403,
        message: '无权访问该店铺数据',
        code: 'SHOP_ACCESS_DENIED'
      };
    }

    return null; // 验证通过
  }

  /**
   * 验证商品访问权限
   * 确保商户只能访问自己店铺的商品数据
   * @param {Object} req - Express请求对象
   * @param {number} productId - 商品ID（可选，用于特定商品验证）
   * @returns {Object|null} 返回验证错误信息或null（验证通过）
   */
  validateProductAccess(req, productId = null) {
    // 先验证商户身份
    const merchantAuthError = this.validateMerchantAuth(req);
    if (merchantAuthError) {
      return merchantAuthError;
    }

    // 如果提供了商品ID，可以在这里添加更具体的验证逻辑
    // 例如：验证商品是否属于商户的店铺
    if (productId) {
      // 这里可以添加数据库查询来验证商品归属
      // 暂时只做基础验证
    }

    return null; // 验证通过
  }

  /**
   * 获取商户ID
   * 从请求对象中安全地获取商户ID
   * @param {Object} req - Express请求对象
   * @returns {number|null} 商户ID或null
   */
  getMerchantId(req) {
    return req.user?.merchantId || req.merchantId || null;
  }

  /**
   * 获取商户店铺ID列表
   * 从请求对象中安全地获取商户的店铺ID列表
   * @param {Object} req - Express请求对象
   * @returns {Array} 店铺ID数组
   */
  getMerchantShopIds(req) {
    return req.user?.shopIds || [];
  }

  /**
   * 构建商户数据查询条件
   * 为数据库查询添加商户数据隔离条件
   * @param {Object} req - Express请求对象
   * @param {Object} baseConditions - 基础查询条件
   * @returns {Object} 包含商户隔离的查询条件
   */
  buildMerchantQuery(req, baseConditions = {}) {
    const merchantId = this.getMerchantId(req);
    
    if (!merchantId) {
      throw new Error('无法获取商户ID');
    }

    return {
      ...baseConditions,
      merchantId: merchantId
    };
  }

  /**
   * 构建店铺数据查询条件
   * 为数据库查询添加店铺数据隔离条件
   * @param {Object} req - Express请求对象
   * @param {Object} baseConditions - 基础查询条件
   * @param {number} shopId - 特定店铺ID（可选）
   * @returns {Object} 包含店铺隔离的查询条件
   */
  buildShopQuery(req, baseConditions = {}, shopId = null) {
    const merchantId = this.getMerchantId(req);
    const shopIds = this.getMerchantShopIds(req);
    
    if (!merchantId) {
      throw new Error('无法获取商户ID');
    }

    const query = {
      ...baseConditions,
      merchantId: merchantId
    };

    // 如果指定了特定店铺ID
    if (shopId) {
      query.shopId = shopId;
    } else if (shopIds.length > 0) {
      // 限制在商户拥有的店铺范围内
      query.shopId = { $in: shopIds };
    }

    return query;
  }

  /**
   * 记录商户操作日志
   * 扩展基础日志记录，添加商户相关信息
   * @param {string} action - 操作描述
   * @param {Object} req - Express请求对象
   * @param {Object} additionalData - 额外的日志数据
   */
  logMerchantAction(action, req, additionalData = {}) {
    const merchantId = this.getMerchantId(req);
    
    this.logAction(action, req, {
      ...additionalData,
      merchantId: merchantId,
      userType: 'merchant',
      shopIds: this.getMerchantShopIds(req)
    });
  }

  /**
   * 记录商户错误日志
   * 扩展基础错误日志记录，添加商户相关信息
   * @param {string} message - 错误消息
   * @param {Error} error - 错误对象
   * @param {Object} req - Express请求对象
   * @param {Object} additionalData - 额外的日志数据
   */
  logMerchantError(message, error, req, additionalData = {}) {
    const merchantId = this.getMerchantId(req);
    
    this.logError(message, error, req, {
      ...additionalData,
      merchantId: merchantId,
      userType: 'merchant',
      shopIds: this.getMerchantShopIds(req)
    });
  }

  /**
   * 发送商户成功响应
   * 扩展基础成功响应，添加商户相关元数据
   * @param {Object} res - Express响应对象
   * @param {string} message - 成功消息
   * @param {Object} data - 响应数据
   * @param {number} status - HTTP状态码
   */
  sendMerchantSuccess(res, message, data = {}, status = 200) {
    const responseData = {
      ...data,
      _metadata: {
        userType: 'merchant',
        timestamp: new Date().toISOString(),
        ...data._metadata
      }
    };

    return this.sendSuccess(res, message, responseData, status);
  }

  /**
   * 发送商户错误响应
   * 扩展基础错误响应，添加商户相关元数据
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   * @param {number} status - HTTP状态码
   * @param {Object} errors - 详细错误信息
   */
  sendMerchantError(res, message, status = 500, errors = null) {
    return this.sendError(res, message, status, errors);
  }

  /**
   * 处理分页参数（商户端专用）
   * 为商户端接口处理分页参数，设置合理的默认值和限制
   * @param {Object} req - Express请求对象
   * @returns {Object} 分页参数对象
   */
  handleMerchantPagination(req) {
    const { page = 1, limit = 20 } = req.query;
    
    // 商户端分页限制：每页最多100条记录
    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    
    return {
      page: parsedPage,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit
    };
  }
}

// 导出商户端基础控制器类，供商户端控制器继承使用
module.exports = BaseMerchantController;
