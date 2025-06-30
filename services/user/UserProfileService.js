/**
 * 用户资料服务
 * 处理用户资料管理相关业务逻辑
 */

const BaseService = require('../base/BaseService');

class UserProfileService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 获取用户资料
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 用户资料
   */
  async getUserProfile(userId, sequelize) {
    try {
      this.logAction('获取用户资料', { userId });

      const User = sequelize.models.User;
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      this.logAction('获取用户资料成功', { userId });
      return user;

    } catch (error) {
      this.logError('获取用户资料失败', error, { userId });
      throw error;
    }
  }

  /**
   * 更新用户资料
   * @param {number} userId - 用户ID
   * @param {Object} profileData - 资料数据
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 更新后的用户资料
   */
  async updateUserProfile(userId, profileData, sequelize) {
    try {
      this.logAction('更新用户资料', { userId, fields: Object.keys(profileData) });

      // 验证输入数据
      const validation = this.validateProfileData(profileData);
      if (!validation.isValid) {
        throw new Error('资料数据验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      // 过滤允许更新的字段
      const allowedFields = ['nickname', 'avatar', 'phone', 'gender', 'birthday', 'bio'];
      const updateData = {};
      
      allowedFields.forEach(field => {
        if (profileData[field] !== undefined) {
          updateData[field] = profileData[field];
        }
      });

      // 添加更新时间
      updateData.updated_at = new Date();

      // 更新用户资料
      await user.update(updateData);

      // 清除缓存
      await this.clearCache([`user_profile_${userId}`]);

      // 返回更新后的用户信息（不包含密码）
      const updatedUser = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });

      this.logAction('更新用户资料成功', { userId });
      return updatedUser;

    } catch (error) {
      this.logError('更新用户资料失败', error, { userId });
      throw error;
    }
  }

  /**
   * 上传用户头像
   * @param {number} userId - 用户ID
   * @param {string} avatarUrl - 头像URL
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 更新结果
   */
  async updateUserAvatar(userId, avatarUrl, sequelize) {
    try {
      this.logAction('更新用户头像', { userId, avatarUrl });

      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      // 更新头像
      await user.update({
        avatar: avatarUrl,
        updated_at: new Date()
      });

      // 清除缓存
      await this.clearCache([`user_profile_${userId}`]);

      this.logAction('更新用户头像成功', { userId });
      return { avatar: avatarUrl };

    } catch (error) {
      this.logError('更新用户头像失败', error, { userId });
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 用户统计信息
   */
  async getUserStats(userId, sequelize) {
    try {
      this.logAction('获取用户统计信息', { userId });

      // 使用缓存
      const cacheKey = `user_stats_${userId}`;
      const cachedStats = await this.getOrSetCache(cacheKey, async () => {
        const User = sequelize.models.User;
        const user = await User.findByPk(userId);

        if (!user) {
          throw new Error('用户不存在');
        }

        // 计算统计信息
        const stats = {
          joinDate: user.created_at,
          lastLogin: user.last_login,
          loginCount: user.login_count || 0,
          profileCompleteness: this.calculateProfileCompleteness(user)
        };

        return stats;
      }, 1800); // 30分钟缓存

      this.logAction('获取用户统计信息成功', { userId });
      return cachedStats;

    } catch (error) {
      this.logError('获取用户统计信息失败', error, { userId });
      throw error;
    }
  }

  /**
   * 验证资料数据
   * @param {Object} profileData - 资料数据
   * @returns {Object} 验证结果
   */
  validateProfileData(profileData) {
    const rules = {
      nickname: {
        type: 'string',
        minLength: 2,
        maxLength: 20,
        pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_\s]+$/,
        patternMessage: '昵称只能包含中文、字母、数字、下划线和空格'
      },
      phone: {
        type: 'string',
        pattern: /^1[3-9]\d{9}$/,
        patternMessage: '手机号格式不正确'
      },
      gender: {
        type: 'string',
        enum: ['male', 'female', 'other'],
      },
      bio: {
        type: 'string',
        maxLength: 200
      }
    };

    return this.validateData(profileData, rules);
  }

  /**
   * 计算资料完整度
   * @param {Object} user - 用户对象
   * @returns {number} 完整度百分比
   */
  calculateProfileCompleteness(user) {
    const fields = ['username', 'email', 'nickname', 'avatar', 'phone', 'gender', 'birthday', 'bio'];
    const completedFields = fields.filter(field => {
      const value = user[field];
      return value !== null && value !== undefined && value !== '';
    });

    return Math.round((completedFields.length / fields.length) * 100);
  }

  /**
   * 检查用户是否存在
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<boolean>} 是否存在
   */
  async checkUserExists(userId, sequelize) {
    try {
      const User = sequelize.models.User;
      const user = await User.findByPk(userId, {
        attributes: ['id']
      });

      return !!user;

    } catch (error) {
      this.logError('检查用户是否存在失败', error, { userId });
      return false;
    }
  }

  /**
   * 获取用户基本信息（公开信息）
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 用户基本信息
   */
  async getUserBasicInfo(userId, sequelize) {
    try {
      this.logAction('获取用户基本信息', { userId });

      const User = sequelize.models.User;
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'nickname', 'avatar', 'created_at']
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      this.logAction('获取用户基本信息成功', { userId });
      return user;

    } catch (error) {
      this.logError('获取用户基本信息失败', error, { userId });
      throw error;
    }
  }
}

module.exports = UserProfileService;
