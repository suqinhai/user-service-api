/**
 * 用户认证服务
 * 处理用户登录、注册、令牌管理等认证相关业务逻辑
 */

const BaseService = require('../base/BaseService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { USER_STATUS, USER_ROLE, COMMON_STATUS } = require('../../../common/constants/status');
const { StatusHelper } = require('../../../common/utils/statusHelper');

class UserAuthService extends BaseService {
  constructor() {
    super();
    this.saltRounds = 12;
    this.jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  /**
   * 用户登录
   * @param {string} username - 用户名或邮箱
   * @param {string} password - 密码
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 登录结果
   */
  async login(username, password, sequelize) {
    try {

      // 验证输入参数
      const validation = this.validateData({ username, password }, {
        username: { required: true, type: 'string', minLength: 3 },
        password: { required: true, type: 'string', minLength: 6 }
      });

      if (!validation.isValid) {
        throw new Error('登录参数验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      // 查找用户
      const User = sequelize.models.User;
      const user = await User.findOne({
        where: {
          username: username,
          role: USER_ROLE.USER,
          status: USER_STATUS.ACTIVE
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查用户状态
      if (!StatusHelper.isUserActive(user.status)) {
        throw new Error(`用户状态异常: ${StatusHelper.getDescription('USER_STATUS', user.status)}`);
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // 记录登录失败
        await this.recordLoginAttempt(user.id, COMMON_STATUS.FAILED, sequelize);
        throw new Error('密码错误');
      }

      // 生成令牌
      const tokens = await this.generateTokens(user);

      // 更新最后登录时间
      await user.update({
        last_login: new Date(),
        login_count: (user.login_count || 0) + 1
      });

      // // 记录登录成功
      // await this.recordLoginAttempt(user.id, COMMON_STATUS.SUCCESS, sequelize);

      // 清除敏感信息
      const userInfo = this.sanitizeUserInfo(user);

      // this.logAction('用户登录成功', { userId: user.id, username: user.username });

      return {
        user: userInfo,
        tokens
      };

    } catch (error) {
      this.logError('用户登录失败', error, { username });
      throw error;
    }
  }

  /**
   * 用户注册
   * @param {Object} userData - 用户数据
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 注册结果
   */
  async register(userData, sequelize) {
    try {
      this.logAction('用户注册尝试', { username: userData.username, email: userData.email });

      // 验证输入数据
      const validation = this.validateData(userData, {
        username: { 
          required: true, 
          type: 'string', 
          minLength: 3, 
          maxLength: 20,
          pattern: /^[a-zA-Z0-9_]+$/,
          patternMessage: '用户名只能包含字母、数字和下划线'
        },
        email: { 
          required: true, 
          type: 'string',
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          patternMessage: '邮箱格式不正确'
        },
        password: { 
          required: true, 
          type: 'string', 
          minLength: 8,
          pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          patternMessage: '密码必须包含大小写字母和数字'
        }
      });

      if (!validation.isValid) {
        throw new Error('注册数据验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      const User = sequelize.models.User;

      // 检查用户名是否已存在
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { username: userData.username },
            { email: userData.email }
          ]
        }
      });

      if (existingUser) {
        if (existingUser.username === userData.username) {
          throw new Error('用户名已存在');
        }
        if (existingUser.email === userData.email) {
          throw new Error('邮箱已被注册');
        }
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds);

      // 创建用户
      const newUser = await User.create({
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        status: 'active',
        created_at: new Date()
      });

      // 生成令牌
      const tokens = await this.generateTokens(newUser);

      // 清除敏感信息
      const userInfo = this.sanitizeUserInfo(newUser);

      this.logAction('用户注册成功', { userId: newUser.id, username: newUser.username });

      return {
        user: userInfo,
        tokens
      };

    } catch (error) {
      this.logError('用户注册失败', error, userData);
      throw error;
    }
  }

  /**
   * 刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 新令牌
   */
  async refreshToken(refreshToken, sequelize) {
    try {
      this.logAction('令牌刷新尝试');

      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('无效的刷新令牌');
      }

      // 查找用户
      const User = sequelize.models.User;
      const user = await User.findByPk(decoded.id);

      if (!user || user.status !== 'active') {
        throw new Error('用户不存在或状态异常');
      }

      // 生成新令牌
      const tokens = await this.generateTokens(user);

      this.logAction('令牌刷新成功', { userId: user.id });

      return tokens;

    } catch (error) {
      this.logError('令牌刷新失败', error);
      throw error;
    }
  }

  /**
   * 用户登出
   * @param {string} token - 访问令牌
   * @returns {Promise<boolean>} 登出结果
   */
  async logout(token) {
    try {
      this.logAction('用户登出');

      // 将令牌加入黑名单（使用缓存）
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.cache.set('blacklist', token, COMMON_STATUS.YES, ttl);
        }
      }

      this.logAction('用户登出成功');
      return COMMON_STATUS.SUCCESS;

    } catch (error) {
      this.logError('用户登出失败', error);
      throw error;
    }
  }

  /**
   * 生成访问令牌和刷新令牌
   * @param {Object} user - 用户对象
   * @returns {Promise<Object>} 令牌对象
   */
  async generateTokens(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status
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
      expiresIn: this.jwtExpiresIn
    };
  }

  /**
   * 验证令牌
   * @param {string} token - 访问令牌
   * @returns {Promise<Object>} 解码后的令牌数据
   */
  async verifyToken(token) {
    try {
      // 检查令牌是否在黑名单中
      const isBlacklisted = await this.cache.get('blacklist', token);
      if (isBlacklisted) {
        throw new Error('令牌已失效');
      }

      // 验证令牌
      const decoded = jwt.verify(token, this.jwtSecret);
      
      if (decoded.type !== 'access') {
        throw new Error('无效的访问令牌');
      }

      return decoded;

    } catch (error) {
      throw new Error('令牌验证失败: ' + error.message);
    }
  }

  /**
   * 记录登录尝试
   * @param {number} userId - 用户ID
   * @param {boolean} success - 是否成功
   * @param {Object} sequelize - 数据库实例
   */
  async recordLoginAttempt(userId, success, sequelize) {
    try {
      const LoginLog = sequelize.models.LoginLog;
      if (LoginLog) {
        await LoginLog.create({
          user_id: userId,
          success,
          created_at: new Date()
        });
      }
    } catch (error) {
      this.logError('记录登录日志失败', error);
    }
  }

  /**
   * 修改密码
   * @param {number} userId - 用户ID
   * @param {string} currentPassword - 当前密码
   * @param {string} newPassword - 新密码
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<boolean>} 修改结果
   */
  async changePassword(userId, currentPassword, newPassword, sequelize) {
    try {
      this.logAction('修改密码尝试', { userId });

      // 验证新密码格式
      const validation = this.validateData({ newPassword }, {
        newPassword: {
          required: true,
          type: 'string',
          minLength: 8,
          pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          patternMessage: '新密码必须包含大小写字母和数字'
        }
      });

      if (!validation.isValid) {
        throw new Error('新密码格式验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      // 查找用户
      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证当前密码
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('当前密码错误');
      }

      // 检查新密码是否与当前密码相同
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new Error('新密码不能与当前密码相同');
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

      // 更新密码
      await user.update({
        password: hashedNewPassword,
        password_updated_at: new Date()
      });

      this.logAction('密码修改成功', { userId });
      return COMMON_STATUS.SUCCESS;

    } catch (error) {
      this.logError('密码修改失败', error, { userId });
      throw error;
    }
  }

  /**
   * 清理用户敏感信息
   * @param {Object} user - 用户对象
   * @returns {Object} 清理后的用户信息
   */
  sanitizeUserInfo(user) {
    const userObj = user.toJSON ? user.toJSON() : user;
    const { password, ...sanitizedUser } = userObj;
    return sanitizedUser;
  }
}

module.exports = UserAuthService;
