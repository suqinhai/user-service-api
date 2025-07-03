/**
 * 商户认证服务类
 * 功能：处理商户端认证相关的业务逻辑，包括登录、注册、令牌管理等
 * 继承：BaseMerchantService，获得商户端特有的功能和数据隔离能力
 * 职责：用户验证、密码加密、JWT令牌生成、会话管理
 */

// 引入商户端基础服务类，提供商户端通用功能
const BaseMerchantService = require('../base/BaseMerchantService');
// 引入bcrypt用于密码加密和验证
const bcrypt = require('bcrypt');
// 引入jsonwebtoken用于JWT令牌操作
const jwt = require('jsonwebtoken');
const { MERCHANT_STATUS, USER_STATUS, COMMON_STATUS } = require('../../common/constants/status');
const { StatusHelper } = require('../../common/utils/statusHelper');

class MerchantAuthService extends BaseMerchantService {
  /**
   * 构造函数：初始化商户认证服务
   * 调用父类构造函数并设置认证相关配置
   */
  constructor() {
    // 调用父类构造函数，获得商户端基础功能
    super();
    
    // JWT配置
    this.jwtSecret = process.env.JWT_SECRET || 'merchant_default_secret';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    
    // 密码加密配置
    this.saltRounds = 12;
  }

  /**
   * 商户登录
   * @param {string} username - 用户名或邮箱
   * @param {string} password - 密码
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 登录结果，包含商户信息和令牌
   */
  async login(username, password, sequelize) {
    try {
      this.logInfo('商户登录尝试', { username });

      // 查找商户用户（支持用户名或邮箱登录）
      const User = sequelize.models.User || sequelize.models.user;
      if (!User) {
        throw new Error('用户模型不存在');
      }

      const merchant = await User.findOne({
        where: {
          $or: [
            { username: username },
            { email: username }
          ],
          userType: 'merchant', // 确保是商户类型用户
          status: 1 // 确保账户状态正常
        }
      });

      if (!merchant) {
        throw new Error('商户不存在或账户状态异常');
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, merchant.password);
      if (!isPasswordValid) {
        throw new Error('密码错误');
      }

      // 检查商户状态
      if (merchant.merchantStatus !== undefined && merchant.merchantStatus !== 1) {
        throw new Error('商户账户状态异常，请联系管理员');
      }

      // 生成访问令牌和刷新令牌
      const tokens = await this.generateTokens(merchant);

      // 更新最后登录时间
      await merchant.update({
        lastLoginAt: new Date(),
        lastLoginIp: null // 可以从请求中获取IP
      });

      // 准备返回的商户信息（移除敏感信息）
      const merchantInfo = {
        id: merchant.id,
        username: merchant.username,
        email: merchant.email,
        merchantId: merchant.merchantId,
        shopIds: merchant.shopIds || [],
        businessName: merchant.businessName,
        businessType: merchant.businessType,
        status: merchant.status,
        merchantStatus: merchant.merchantStatus,
        createdAt: merchant.createdAt,
        lastLoginAt: merchant.lastLoginAt
      };

      this.logInfo('商户登录成功', { 
        merchantId: merchant.merchantId, 
        userId: merchant.id 
      });

      return {
        merchant: merchantInfo,
        tokens: tokens
      };

    } catch (error) {
      this.logError('商户登录失败', error, { username });
      throw error;
    }
  }

  /**
   * 刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 新的令牌对
   */
  async refreshToken(refreshToken, sequelize) {
    try {
      this.logInfo('商户令牌刷新尝试');

      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('无效的刷新令牌类型');
      }

      // 查找商户用户
      const User = sequelize.models.User || sequelize.models.user;
      const merchant = await User.findByPk(decoded.id);

      if (!merchant || merchant.userType !== 'merchant') {
        throw new Error('商户不存在');
      }

      if (merchant.status !== 1 || merchant.merchantStatus !== 1) {
        throw new Error('商户账户状态异常');
      }

      // 生成新的令牌对
      const tokens = await this.generateTokens(merchant);

      this.logInfo('商户令牌刷新成功', { 
        merchantId: merchant.merchantId, 
        userId: merchant.id 
      });

      return tokens;

    } catch (error) {
      this.logError('商户令牌刷新失败', error);
      throw error;
    }
  }

  /**
   * 商户登出
   * @param {string} token - 访问令牌
   * @returns {boolean} 登出结果
   */
  async logout(token) {
    try {
      this.logInfo('商户登出尝试');

      // 验证令牌
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // 这里可以将令牌加入黑名单（如果有Redis等缓存系统）
      // 目前简单返回成功
      
      this.logInfo('商户登出成功', { 
        merchantId: decoded.merchantId, 
        userId: decoded.id 
      });

      return true;

    } catch (error) {
      this.logError('商户登出失败', error);
      throw error;
    }
  }

  /**
   * 生成访问令牌和刷新令牌
   * @param {Object} merchant - 商户用户对象
   * @returns {Object} 令牌对象
   */
  async generateTokens(merchant) {
    try {
      const payload = {
        id: merchant.id,
        username: merchant.username,
        email: merchant.email,
        merchantId: merchant.merchantId,
        shopIds: merchant.shopIds || [],
        userType: 'merchant'
      };

      // 生成访问令牌
      const accessToken = jwt.sign(
        { ...payload, type: 'access' },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn }
      );

      // 生成刷新令牌
      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        this.jwtSecret,
        { expiresIn: this.refreshTokenExpiresIn }
      );

      // 计算过期时间
      const expiresIn = this.parseExpiresIn(this.jwtExpiresIn);

      return {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer'
      };

    } catch (error) {
      this.logError('生成商户令牌失败', error);
      throw error;
    }
  }

  /**
   * 解析过期时间字符串为秒数
   * @param {string} expiresIn - 过期时间字符串（如'24h', '7d'）
   * @returns {number} 过期时间（秒）
   */
  parseExpiresIn(expiresIn) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 86400; // 默认24小时
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }
}

// 导出商户认证服务类，供控制器使用
module.exports = MerchantAuthService;
