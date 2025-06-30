/**
 * 用户资料控制器
 * 处理用户端资料管理相关的HTTP请求
 */

const BaseController = require('../base/BaseController');
const UserProfileService = require('../../services/user/UserProfileService');

class UserProfileController extends BaseController {
  constructor() {
    super();
    this.userProfileService = new UserProfileService();
  }

  /**
   * 获取当前用户资料
   * GET /api/user/profile
   */
  getProfile = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取用户资料请求', req, { userId: req.user?.id });

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      // 调用服务层获取用户资料
      const profile = await this.userProfileService.getUserProfile(req.user.id, res.sequelize);

      return this.sendSuccess(res, '获取用户资料成功', {
        profile
      });

    } catch (error) {
      this.logError('获取用户资料失败', error, req);
      return this.sendError(res, '获取用户资料失败', 500);
    }
  });

  /**
   * 更新用户资料
   * PUT /api/user/profile
   */
  updateProfile = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('更新用户资料请求', req, { userId: req.user?.id });

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      const { nickname, phone, gender, birthday, bio } = req.body;

      // 构建更新数据
      const updateData = {};
      if (nickname !== undefined) updateData.nickname = nickname;
      if (phone !== undefined) updateData.phone = phone;
      if (gender !== undefined) updateData.gender = gender;
      if (birthday !== undefined) updateData.birthday = birthday;
      if (bio !== undefined) updateData.bio = bio;

      // 检查是否有数据需要更新
      if (Object.keys(updateData).length === 0) {
        return this.sendError(res, '没有提供需要更新的数据', 400);
      }

      // 调用服务层更新用户资料
      const updatedProfile = await this.userProfileService.updateUserProfile(
        req.user.id,
        updateData,
        res.sequelize
      );

      return this.sendSuccess(res, '用户资料更新成功', {
        profile: updatedProfile
      });

    } catch (error) {
      this.logError('更新用户资料失败', error, req);
      
      if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '更新用户资料失败', 500);
      }
    }
  });

  /**
   * 上传用户头像
   * POST /api/user/profile/avatar
   */
  uploadAvatar = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('上传用户头像请求', req, { userId: req.user?.id });

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      const { avatarUrl } = req.body;

      // 验证头像URL
      if (!avatarUrl) {
        return this.sendError(res, '头像URL不能为空', 400);
      }

      // 简单的URL格式验证
      const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
      if (!urlPattern.test(avatarUrl)) {
        return this.sendError(res, '头像URL格式不正确', 400);
      }

      // 调用服务层更新头像
      const result = await this.userProfileService.updateUserAvatar(
        req.user.id,
        avatarUrl,
        res.sequelize
      );

      return this.sendSuccess(res, '头像上传成功', result);

    } catch (error) {
      this.logError('上传用户头像失败', error, req);
      return this.sendError(res, '头像上传失败', 500);
    }
  });

  /**
   * 获取用户统计信息
   * GET /api/user/profile/stats
   */
  getStats = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取用户统计信息请求', req, { userId: req.user?.id });

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      // 调用服务层获取统计信息
      const stats = await this.userProfileService.getUserStats(req.user.id, res.sequelize);

      return this.sendSuccess(res, '获取用户统计信息成功', {
        stats
      });

    } catch (error) {
      this.logError('获取用户统计信息失败', error, req);
      return this.sendError(res, '获取用户统计信息失败', 500);
    }
  });

  /**
   * 获取其他用户的基本信息
   * GET /api/user/profile/:userId
   */
  getUserBasicInfo = this.asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      
      this.logAction('获取用户基本信息请求', req, { targetUserId: userId });

      // 验证用户ID
      if (!userId || isNaN(parseInt(userId))) {
        return this.sendError(res, '用户ID格式不正确', 400);
      }

      // 调用服务层获取用户基本信息
      const userInfo = await this.userProfileService.getUserBasicInfo(
        parseInt(userId),
        res.sequelize
      );

      return this.sendSuccess(res, '获取用户基本信息成功', {
        user: userInfo
      });

    } catch (error) {
      this.logError('获取用户基本信息失败', error, req);
      
      if (error.message.includes('用户不存在')) {
        return this.sendError(res, '用户不存在', 404);
      } else {
        return this.sendError(res, '获取用户基本信息失败', 500);
      }
    }
  });

  /**
   * 检查用户名是否可用
   * GET /api/user/profile/check-username/:username
   */
  checkUsername = this.asyncHandler(async (req, res) => {
    try {
      const { username } = req.params;
      
      this.logAction('检查用户名可用性请求', req, { username });

      // 验证用户名格式
      if (!username || username.length < 3 || username.length > 20) {
        return this.sendError(res, '用户名长度必须在3-20个字符之间', 400);
      }

      const usernamePattern = /^[a-zA-Z0-9_]+$/;
      if (!usernamePattern.test(username)) {
        return this.sendError(res, '用户名只能包含字母、数字和下划线', 400);
      }

      // 检查用户名是否已存在
      const User = res.sequelize.models.User;
      const existingUser = await User.findOne({
        where: { username },
        attributes: ['id']
      });

      const isAvailable = !existingUser;

      return this.sendSuccess(res, '用户名检查完成', {
        username,
        available: isAvailable,
        message: isAvailable ? '用户名可用' : '用户名已被使用'
      });

    } catch (error) {
      this.logError('检查用户名可用性失败', error, req);
      return this.sendError(res, '检查用户名可用性失败', 500);
    }
  });

  /**
   * 获取资料完整度
   * GET /api/user/profile/completeness
   */
  getProfileCompleteness = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取资料完整度请求', req, { userId: req.user?.id });

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      // 获取用户完整资料
      const profile = await this.userProfileService.getUserProfile(req.user.id, res.sequelize);
      
      // 计算完整度
      const completeness = this.userProfileService.calculateProfileCompleteness(profile);

      // 提供完善建议
      const suggestions = this.getProfileSuggestions(profile);

      return this.sendSuccess(res, '获取资料完整度成功', {
        completeness,
        suggestions
      });

    } catch (error) {
      this.logError('获取资料完整度失败', error, req);
      return this.sendError(res, '获取资料完整度失败', 500);
    }
  });

  /**
   * 获取资料完善建议
   * @param {Object} profile - 用户资料
   * @returns {Array} 建议列表
   */
  getProfileSuggestions(profile) {
    const suggestions = [];
    
    if (!profile.nickname) {
      suggestions.push({ field: 'nickname', message: '设置昵称让其他用户更容易记住你' });
    }
    
    if (!profile.avatar) {
      suggestions.push({ field: 'avatar', message: '上传头像让你的资料更加个性化' });
    }
    
    if (!profile.phone) {
      suggestions.push({ field: 'phone', message: '绑定手机号提高账户安全性' });
    }
    
    if (!profile.bio) {
      suggestions.push({ field: 'bio', message: '添加个人简介让别人了解你' });
    }

    return suggestions;
  }
}

module.exports = UserProfileController;
