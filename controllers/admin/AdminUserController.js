/**
 * 管理员用户控制器
 * 处理管理端用户管理相关的HTTP请求
 */

const BaseController = require('../base/BaseController');
const AdminUserService = require('../../services/admin/AdminUserService');
const { USER_STATUS, USER_ROLE, COMMON_STATUS } = require('../../common/constants/status');
const { StatusHelper } = require('../../common/utils/statusHelper');

class AdminUserController extends BaseController {
  constructor() {
    super();
    this.adminUserService = new AdminUserService();
  }

  /**
   * 获取用户列表
   * GET /api/admin/users
   */
  getUserList = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取用户列表请求', req);

      // 获取分页参数
      const pagination = this.getPaginationParams(req);
      
      // 获取排序参数
      const sort = this.getSortParams(req, 'created_at', 'DESC');
      
      // 获取过滤条件
      const filters = {
        status: req.query.status,
        role: req.query.role,
        search: req.query.search,
        createdAfter: req.query.createdAfter,
        createdBefore: req.query.createdBefore
      };

      // 调用服务层获取用户列表
      const result = await this.adminUserService.getUserList(
        filters,
        pagination,
        sort,
        res.sequelize
      );

      return this.sendPaginatedResponse(
        res,
        result.users,
        result.pagination,
        '获取用户列表成功'
      );

    } catch (error) {
      this.logError('获取用户列表失败', error, req);
      return this.sendError(res, '获取用户列表失败', 500);
    }
  });

  /**
   * 获取用户详情
   * GET /api/admin/users/:id
   */
  getUserDetail = this.asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      this.logAction('获取用户详情请求', req, { targetUserId: id });

      // 验证用户ID
      if (!id || isNaN(parseInt(id))) {
        return this.sendError(res, '用户ID格式不正确', 400);
      }

      // 调用服务层获取用户详情
      const result = await this.adminUserService.getUserDetail(
        parseInt(id),
        res.sequelize
      );

      return this.sendSuccess(res, '获取用户详情成功', result);

    } catch (error) {
      this.logError('获取用户详情失败', error, req);
      
      if (error.message.includes('用户不存在')) {
        return this.sendError(res, '用户不存在', 404);
      } else {
        return this.sendError(res, '获取用户详情失败', 500);
      }
    }
  });

  /**
   * 创建用户
   * POST /api/admin/users
   */
  createUser = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('创建用户请求', req);

      const { username, email, password, nickname, phone, status, role } = req.body;

      // 验证必需参数
      const validationErrors = this.validateRequiredFields(req, ['username', 'email', 'password']);
      if (validationErrors) {
        return this.sendError(res, '请求参数不完整', 400, validationErrors);
      }

      // 构建用户数据
      const userData = {
        username,
        email,
        password,
        nickname,
        phone,
        status,
        role
      };

      // 调用服务层创建用户
      const newUser = await this.adminUserService.createUser(userData, res.sequelize);

      return this.sendSuccess(res, '用户创建成功', {
        user: newUser
      }, 201);

    } catch (error) {
      this.logError('创建用户失败', error, req);
      
      if (error.message.includes('已存在') || error.message.includes('已被注册')) {
        return this.sendError(res, error.message, 409);
      } else if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '创建用户失败', 500);
      }
    }
  });

  /**
   * 更新用户信息
   * PUT /api/admin/users/:id
   */
  updateUser = this.asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      this.logAction('更新用户信息请求', req, { targetUserId: id });

      // 验证用户ID
      if (!id || isNaN(parseInt(id))) {
        return this.sendError(res, '用户ID格式不正确', 400);
      }

      const { email, nickname, phone, status, role } = req.body;

      // 构建更新数据
      const updateData = {};
      if (email !== undefined) updateData.email = email;
      if (nickname !== undefined) updateData.nickname = nickname;
      if (phone !== undefined) updateData.phone = phone;
      if (status !== undefined) updateData.status = status;
      if (role !== undefined) updateData.role = role;

      // 检查是否有数据需要更新
      if (Object.keys(updateData).length === 0) {
        return this.sendError(res, '没有提供需要更新的数据', 400);
      }

      // 调用服务层更新用户
      const updatedUser = await this.adminUserService.updateUser(
        parseInt(id),
        updateData,
        res.sequelize
      );

      return this.sendSuccess(res, '用户信息更新成功', {
        user: updatedUser
      });

    } catch (error) {
      this.logError('更新用户信息失败', error, req);
      
      if (error.message.includes('用户不存在')) {
        return this.sendError(res, '用户不存在', 404);
      } else if (error.message.includes('验证失败') || error.message.includes('已被其他用户使用')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '更新用户信息失败', 500);
      }
    }
  });

  /**
   * 更新用户状态
   * PATCH /api/admin/users/:id/status
   */
  updateUserStatus = this.asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      this.logAction('更新用户状态请求', req, { targetUserId: id, status });

      // 验证参数
      if (!id || isNaN(parseInt(id))) {
        return this.sendError(res, '用户ID格式不正确', 400);
      }

      if (!status) {
        return this.sendError(res, '状态参数不能为空', 400);
      }

      // 调用服务层更新用户状态
      const result = await this.adminUserService.updateUserStatus(
        parseInt(id),
        status,
        res.sequelize
      );

      return this.sendSuccess(res, '用户状态更新成功', result);

    } catch (error) {
      this.logError('更新用户状态失败', error, req);
      
      if (error.message.includes('用户不存在')) {
        return this.sendError(res, '用户不存在', 404);
      } else if (error.message.includes('无效的用户状态')) {
        return this.sendError(res, '无效的用户状态', 400);
      } else {
        return this.sendError(res, '更新用户状态失败', 500);
      }
    }
  });

  /**
   * 重置用户密码
   * POST /api/admin/users/:id/reset-password
   */
  resetUserPassword = this.asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      
      this.logAction('重置用户密码请求', req, { targetUserId: id });

      // 验证参数
      if (!id || isNaN(parseInt(id))) {
        return this.sendError(res, '用户ID格式不正确', 400);
      }

      if (!newPassword) {
        return this.sendError(res, '新密码不能为空', 400);
      }

      // 调用服务层重置密码
      await this.adminUserService.resetUserPassword(
        parseInt(id),
        newPassword,
        res.sequelize
      );

      return this.sendSuccess(res, '用户密码重置成功');

    } catch (error) {
      this.logError('重置用户密码失败', error, req);
      
      if (error.message.includes('用户不存在')) {
        return this.sendError(res, '用户不存在', 404);
      } else if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '重置用户密码失败', 500);
      }
    }
  });

  /**
   * 删除用户
   * DELETE /api/admin/users/:id
   */
  deleteUser = this.asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      this.logAction('删除用户请求', req, { targetUserId: id });

      // 验证用户ID
      if (!id || isNaN(parseInt(id))) {
        return this.sendError(res, '用户ID格式不正确', 400);
      }

      // 防止删除当前登录的管理员
      if (req.user && req.user.id === parseInt(id)) {
        return this.sendError(res, '不能删除当前登录的用户', 400);
      }

      // 调用服务层删除用户
      await this.adminUserService.deleteUser(parseInt(id), res.sequelize);

      return this.sendSuccess(res, '用户删除成功');

    } catch (error) {
      this.logError('删除用户失败', error, req);
      
      if (error.message.includes('用户不存在')) {
        return this.sendError(res, '用户不存在', 404);
      } else {
        return this.sendError(res, '删除用户失败', 500);
      }
    }
  });

  /**
   * 批量更新用户状态
   * PATCH /api/admin/users/batch/status
   */
  batchUpdateUserStatus = this.asyncHandler(async (req, res) => {
    try {
      const { userIds, status } = req.body;
      
      this.logAction('批量更新用户状态请求', req, { userIds, status });

      // 验证参数
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return this.sendError(res, '用户ID列表不能为空', 400);
      }

      if (!status) {
        return this.sendError(res, '状态参数不能为空', 400);
      }

      // 验证用户ID格式
      const invalidIds = userIds.filter(id => isNaN(parseInt(id)));
      if (invalidIds.length > 0) {
        return this.sendError(res, '存在无效的用户ID', 400);
      }

      // 批量更新用户状态
      const results = [];
      const errors = [];

      for (const userId of userIds) {
        try {
          const result = await this.adminUserService.updateUserStatus(
            parseInt(userId),
            status,
            res.sequelize
          );
          results.push(result);
        } catch (error) {
          errors.push({
            userId,
            error: error.message
          });
        }
      }

      return this.sendSuccess(res, '批量更新用户状态完成', {
        successful: results,
        failed: errors,
        summary: {
          total: userIds.length,
          successful: results.length,
          failed: errors.length
        }
      });

    } catch (error) {
      this.logError('批量更新用户状态失败', error, req);
      return this.sendError(res, '批量更新用户状态失败', 500);
    }
  });

  /**
   * 获取用户统计信息
   * GET /api/admin/users/statistics
   */
  getUserStatistics = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取用户统计信息请求', req);

      const User = res.sequelize.models.User;

      // 获取各种统计数据
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        lockedUsers,
        pendingUsers,
        todayRegistrations
      ] = await Promise.all([
        User.count(),
        User.count({ where: { status: 'active' } }),
        User.count({ where: { status: 'inactive' } }),
        User.count({ where: { status: 'locked' } }),
        User.count({ where: { status: 'pending' } }),
        User.count({
          where: {
            created_at: {
              [res.sequelize.Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })
      ]);

      const statistics = {
        total: totalUsers,
        byStatus: {
          active: activeUsers,
          inactive: inactiveUsers,
          locked: lockedUsers,
          pending: pendingUsers
        },
        todayRegistrations,
        lastUpdated: new Date()
      };

      return this.sendSuccess(res, '获取用户统计信息成功', {
        statistics
      });

    } catch (error) {
      this.logError('获取用户统计信息失败', error, req);
      return this.sendError(res, '获取用户统计信息失败', 500);
    }
  });
}

module.exports = AdminUserController;
