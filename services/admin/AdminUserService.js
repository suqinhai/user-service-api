/**
 * 管理员用户服务
 * 处理管理端用户管理相关业务逻辑
 */

const BaseService = require('../base/BaseService');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { USER_STATUS, USER_ROLE, COMMON_STATUS } = require('../../common/constants/status');
const { StatusHelper } = require('../../common/utils/statusHelper');

class AdminUserService extends BaseService {
  constructor() {
    super();
    this.saltRounds = 12;
  }

  /**
   * 获取用户列表
   * @param {Object} filters - 过滤条件
   * @param {Object} pagination - 分页参数
   * @param {Object} sort - 排序参数
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 用户列表和分页信息
   */
  async getUserList(filters, pagination, sort, sequelize) {
    try {
      this.logAction('获取用户列表', { filters, pagination, sort });

      const User = sequelize.models.User;
      
      // 构建查询条件
      const where = this.buildUserWhereCondition(filters);
      
      // 构建排序条件
      const order = [[sort.sortBy, sort.sortOrder]];

      // 执行查询
      const { count, rows } = await User.findAndCountAll({
        where,
        order,
        limit: pagination.limit,
        offset: pagination.offset,
        attributes: { exclude: ['password'] }
      });

      this.logAction('获取用户列表成功', { total: count, returned: rows.length });

      return {
        users: rows,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: count,
          totalPages: Math.ceil(count / pagination.limit)
        }
      };

    } catch (error) {
      this.logError('获取用户列表失败', error, { filters, pagination });
      throw error;
    }
  }

  /**
   * 获取用户详情
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 用户详情
   */
  async getUserDetail(userId, sequelize) {
    try {
      this.logAction('获取用户详情', { userId });

      const User = sequelize.models.User;
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 获取用户统计信息
      const stats = await this.getUserStatistics(userId, sequelize);

      this.logAction('获取用户详情成功', { userId });

      return {
        user,
        stats
      };

    } catch (error) {
      this.logError('获取用户详情失败', error, { userId });
      throw error;
    }
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 创建的用户
   */
  async createUser(userData, sequelize) {
    try {
      this.logAction('创建用户', { username: userData.username, email: userData.email });

      // 验证用户数据
      const validation = this.validateUserData(userData, true);
      if (!validation.isValid) {
        throw new Error('用户数据验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      const User = sequelize.models.User;

      // 检查用户名和邮箱是否已存在
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
        nickname: userData.nickname || userData.username,
        phone: userData.phone,
        status: userData.status || 'active',
        role: userData.role || 'user',
        created_at: new Date()
      });

      // 清除相关缓存
      await this.clearCache(['user_list', 'user_stats']);

      // 返回用户信息（不包含密码）
      const { password, ...userInfo } = newUser.toJSON();

      this.logAction('创建用户成功', { userId: newUser.id, username: newUser.username });

      return userInfo;

    } catch (error) {
      this.logError('创建用户失败', error, userData);
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 更新后的用户信息
   */
  async updateUser(userId, updateData, sequelize) {
    try {
      this.logAction('更新用户信息', { userId, fields: Object.keys(updateData) });

      // 验证更新数据
      const validation = this.validateUserData(updateData, false);
      if (!validation.isValid) {
        throw new Error('用户数据验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      // 如果更新邮箱，检查是否已被其他用户使用
      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await User.findOne({
          where: {
            email: updateData.email,
            id: { [Op.ne]: userId }
          }
        });

        if (existingUser) {
          throw new Error('邮箱已被其他用户使用');
        }
      }

      // 过滤允许更新的字段
      const allowedFields = ['email', 'nickname', 'phone', 'status', 'role'];
      const filteredUpdateData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredUpdateData[field] = updateData[field];
        }
      });

      // 添加更新时间
      filteredUpdateData.updated_at = new Date();

      // 更新用户
      await user.update(filteredUpdateData);

      // 清除相关缓存
      await this.clearCache([`user_${userId}`, 'user_list']);

      // 返回更新后的用户信息
      const updatedUser = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });

      this.logAction('更新用户信息成功', { userId });

      return updatedUser;

    } catch (error) {
      this.logError('更新用户信息失败', error, { userId });
      throw error;
    }
  }

  /**
   * 更新用户状态
   * @param {number} userId - 用户ID
   * @param {string} status - 新状态
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 更新结果
   */
  async updateUserStatus(userId, status, sequelize) {
    try {
      this.logAction('更新用户状态', { userId, status });

      // 验证状态值
      const validStatuses = ['active', 'inactive', 'locked', 'pending'];
      if (!validStatuses.includes(status)) {
        throw new Error('无效的用户状态');
      }

      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      const oldStatus = user.status;

      // 更新状态
      await user.update({
        status,
        updated_at: new Date()
      });

      // 清除相关缓存
      await this.clearCache([`user_${userId}`, 'user_list']);

      this.logAction('更新用户状态成功', { userId, oldStatus, newStatus: status });

      return {
        userId,
        oldStatus,
        newStatus: status,
        updatedAt: new Date()
      };

    } catch (error) {
      this.logError('更新用户状态失败', error, { userId, status });
      throw error;
    }
  }

  /**
   * 重置用户密码
   * @param {number} userId - 用户ID
   * @param {string} newPassword - 新密码
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<boolean>} 重置结果
   */
  async resetUserPassword(userId, newPassword, sequelize) {
    try {
      this.logAction('重置用户密码', { userId });

      // 验证新密码
      const validation = this.validateData({ password: newPassword }, {
        password: {
          required: true,
          type: 'string',
          minLength: 8,
          pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          patternMessage: '密码必须包含大小写字母和数字'
        }
      });

      if (!validation.isValid) {
        throw new Error('密码格式验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

      // 更新密码
      await user.update({
        password: hashedPassword,
        password_updated_at: new Date(),
        updated_at: new Date()
      });

      this.logAction('重置用户密码成功', { userId });

      return COMMON_STATUS.SUCCESS;

    } catch (error) {
      this.logError('重置用户密码失败', error, { userId });
      throw error;
    }
  }

  /**
   * 删除用户
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteUser(userId, sequelize) {
    try {
      this.logAction('删除用户', { userId });

      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('用户不存在');
      }

      // 软删除或硬删除（根据业务需求）
      await user.destroy();

      // 清除相关缓存
      await this.clearCache([`user_${userId}`, 'user_list', 'user_stats']);

      this.logAction('删除用户成功', { userId, username: user.username });

      return COMMON_STATUS.SUCCESS;

    } catch (error) {
      this.logError('删除用户失败', error, { userId });
      throw error;
    }
  }

  /**
   * 构建用户查询条件
   * @param {Object} filters - 过滤条件
   * @returns {Object} 查询条件
   */
  buildUserWhereCondition(filters) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${filters.search}%` } },
        { email: { [Op.like]: `%${filters.search}%` } },
        { nickname: { [Op.like]: `%${filters.search}%` } }
      ];
    }

    if (filters.createdAfter) {
      where.created_at = { [Op.gte]: new Date(filters.createdAfter) };
    }

    if (filters.createdBefore) {
      where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.createdBefore) };
    }

    return where;
  }

  /**
   * 验证用户数据
   * @param {Object} userData - 用户数据
   * @param {boolean} isCreate - 是否为创建操作
   * @returns {Object} 验证结果
   */
  validateUserData(userData, isCreate = COMMON_STATUS.NO) {
    const rules = {
      username: isCreate ? {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_]+$/,
        patternMessage: '用户名只能包含字母、数字和下划线'
      } : undefined,
      email: {
        required: isCreate,
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        patternMessage: '邮箱格式不正确'
      },
      password: isCreate ? {
        required: true,
        type: 'string',
        minLength: 8,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        patternMessage: '密码必须包含大小写字母和数字'
      } : undefined,
      nickname: {
        type: 'string',
        maxLength: 20
      },
      phone: {
        type: 'string',
        pattern: /^1[3-9]\d{9}$/,
        patternMessage: '手机号格式不正确'
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'locked', 'pending']
      },
      role: {
        type: 'string',
        enum: ['user', 'admin', 'super_admin']
      }
    };

    // 过滤掉undefined的规则
    const filteredRules = {};
    Object.keys(rules).forEach(key => {
      if (rules[key] !== undefined) {
        filteredRules[key] = rules[key];
      }
    });

    return this.validateData(userData, filteredRules);
  }

  /**
   * 获取用户统计信息
   * @param {number} userId - 用户ID
   * @param {Object} sequelize - 数据库实例
   * @returns {Promise<Object>} 统计信息
   */
  async getUserStatistics(userId, sequelize) {
    try {
      const User = sequelize.models.User;
      const user = await User.findByPk(userId);

      if (!user) {
        return {};
      }

      return {
        joinDate: user.created_at,
        lastLogin: user.last_login,
        loginCount: user.login_count || 0,
        lastUpdated: user.updated_at
      };

    } catch (error) {
      this.logError('获取用户统计信息失败', error, { userId });
      return {};
    }
  }
}

module.exports = AdminUserService;
