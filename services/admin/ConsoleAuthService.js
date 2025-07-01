/**
 * 总台认证服务
 * 处理总台管理员登录、令牌管理等认证相关业务逻辑
 */

const BaseService = require('../base/BaseService');
const ConsoleLoginTracker = require('./ConsoleLoginTracker');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { USER_STATUS, USER_ROLE, COMMON_STATUS } = require('../../common/constants/status');
const { StatusHelper } = require('../../common/utils/statusHelper');

class ConsoleAuthService extends BaseService {
  constructor() {
    super();
    this.loginTracker = new ConsoleLoginTracker();
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
      this.logAction(`总台登录尝试: ${username}, IP: ${ip}`);

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
          status: {
            [Op.ne]: USER_STATUS.DELETED // 排除已删除用户
          }
        }
      });

      if (!user) {
        // 记录失败尝试
        await this.loginTracker.recordFailedAttempt(username, ip);
        throw new Error('总台账号不存在或无权限');
      }

      // 3. 检查用户状态
      if (!StatusHelper.isUserActive(user.status)) {
        await this.loginTracker.recordFailedAttempt(username, ip);
        throw new Error(`总台账号状态异常: ${StatusHelper.getDescription('USER_STATUS', user.status)}`);
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
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login,
      };

      this.logAction(`总台登录成功: ${username}, ID: ${user.id}, IP: ${ip}`);

      return {
        user: userInfo,
        tokens,
        loginTime: new Date().toISOString()
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
   * 刷新总台令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 新的令牌
   */
  async refreshToken(refreshToken) {
    try {
      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('无效的刷新令牌类型');
      }

      if (decoded.role !== USER_ROLE.CONSOLE_ADMIN) {
        throw new Error('无效的总台刷新令牌');
      }

      // 生成新的令牌对
      const newTokens = await this.generateTokens({
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role
      });

      this.logAction(`总台令牌刷新成功: ${decoded.username}, ID: ${decoded.id}`);

      return newTokens;

    } catch (error) {
      this.logError('总台令牌刷新失败', error);
      throw new Error('刷新令牌无效或已过期');
    }
  }

  /**
   * 验证总台令牌
   * @param {string} token - 访问令牌
   * @returns {Promise<Object>} 解码后的用户信息
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      if (decoded.type !== 'access') {
        throw new Error('无效的令牌类型');
      }

      if (decoded.role !== USER_ROLE.CONSOLE_ADMIN) {
        throw new Error('无效的总台访问令牌');
      }

      return decoded;

    } catch (error) {
      this.logError('总台令牌验证失败', error);
      throw new Error('令牌无效或已过期');
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

  /**
   * 获取总台登录状态信息
   * @param {string} username - 用户名
   * @returns {Promise<Object>} 状态信息
   */
  async getLoginStatus(username) {
    try {
      const lockStatus = await this.loginTracker.checkLockStatus(username);
      const failedAttempts = await this.loginTracker.getFailedAttempts(username);
      
      return {
        isLocked: lockStatus.isLocked,
        lockUntil: lockStatus.lockUntil,
        failedAttempts,
        remainingAttempts: Math.max(0, this.loginTracker.maxFailedAttempts - failedAttempts),
        message: lockStatus.message
      };
      
    } catch (error) {
      this.logError('获取总台登录状态失败', error);
      throw error;
    }
  }
}

module.exports = ConsoleAuthService;
