// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理用户个人资料相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈，用于认证和权限验证
const { stacks } = require('../../../middleware');
// 从控制器模块引入用户个人资料控制器类
const { UserProfileController } = require('../../../controllers');

// 创建用户个人资料控制器实例，用于处理具体的资料管理业务逻辑
const userProfileController = new UserProfileController();

// 获取个人资料路由：需要用户认证，返回当前登录用户的完整个人资料信息
router.get('/', stacks.user.authenticated, userProfileController.getProfile);

// 更新个人资料路由：需要用户认证，允许用户修改昵称、手机号、头像等信息
router.put('/', stacks.user.authenticated, userProfileController.updateProfile);

// 上传头像路由：需要用户认证，处理用户头像文件上传
router.post('/avatar', stacks.user.authenticated, userProfileController.uploadAvatar);
// 获取用户统计信息路由：需要用户认证，返回用户的活动统计数据
router.get('/stats', stacks.user.authenticated, userProfileController.getStats);
// 获取资料完整度路由：需要用户认证，返回用户资料的完整度百分比
router.get('/completeness', stacks.user.authenticated, userProfileController.getProfileCompleteness);
// 检查用户名可用性路由：无需认证，用于注册时验证用户名是否已被使用
router.get('/check-username/:username', userProfileController.checkUsername);
// 获取用户基本信息路由：无需认证，返回指定用户的公开基本信息
router.get('/:userId', userProfileController.getUserBasicInfo);

// 导出路由器，供上级路由使用
module.exports = router;
