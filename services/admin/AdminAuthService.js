/**
 * 总台认证服务
 * 处理总台管理员登录、令牌管理等认证相关业务逻辑
 */

const BaseService = require('../base/BaseService');
const AdminLoginTracker = require('./AdminAuthUtils');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { USER_STATUS, USER_ROLE } = require('../../common/constants/status');
const { StatusHelper } = require('../../common/utils/statusHelper');

class AdminAuthService extends BaseService {
  constructor() {
    super();
    this.loginTracker = new AdminLoginTracker();
    this.jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h'; // 总台令牌8小时有效期
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '24h';
  }

  /**
   * 总台管理员登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {string} ip - 客户端IP地址
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 登录结果
   */
  async login(username, password, ip, sequelize) {
    try {

      // 1. 检查账号是否被锁定
      const lockStatus = await this.loginTracker.checkLockStatus(username);
      if (lockStatus.isLocked) {
        throw new Error(lockStatus.message);
      }

      // 2. 查找总台管理员用户
      const MerchantsUsers = sequelize.models.MerchantsUsers;
      const user = await MerchantsUsers.findOne({
        where: {
          username,
          role: USER_ROLE.CONSOLE_ADMIN, // 只允许总台管理员角色登录
          status: USER_STATUS.ACTIVE
        }
      });

      if (!user) {
        // 记录失败尝试
        await this.loginTracker.recordFailedAttempt(username, ip);
        throw new Error('总台账号不存在或无权限');
      }

      // 4. 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // 记录登录失败
        const failResult = await this.loginTracker.recordFailedAttempt(username, ip);
        throw new Error(failResult.message);
      }

      // 5. 登录成功，清除失败计数
      await this.loginTracker.recordSuccessfulLogin(username, ip);

      // 6. 生成令牌
      const tokens = await this.generateTokens(user);

      // 7. 更新最后登录时间
      await user.update({
        last_login: new Date(),
        login_count: (user.login_count || 0) + 1
      });

      // 8. 返回登录结果（不包含密码）
      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        last_login: user.last_login,
      };

      return {
        user: userInfo,
        tokens,
      };

    } catch (error) {
      this.logError(`总台登录失败: ${username}, IP: ${ip}`, error);
      throw error;
    }
  }

  /**
   * 总台管理员登出
   * @param {string} token - 访问令牌
   * @param {Object} user - 用户信息
   * @returns {Promise<Object>} 登出结果
   */
  async logout(token, user) {
    try {
      this.logAction(`总台登出: ${user.username}, ID: ${user.id}`);
      
      // 这里可以实现令牌黑名单机制
      // 暂时只记录日志
      
      return {
        message: '总台登出成功',
        logoutTime: new Date().toISOString()
      };
      
    } catch (error) {
      this.logError(`总台登出失败: ${user?.username}`, error);
      throw error;
    }
  }

  /**
   * 生成总台访问令牌和刷新令牌
   * @param {Object} user - 用户对象
   * @returns {Promise<Object>} 令牌对象
   */
  async generateTokens(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      userType: 'console_admin'
    };

    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn,
      tokenType: 'Bearer'
    };
  }

}

module.exports = AdminAuthService;
