// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理用户认证相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈，用于认证和权限验证
const { stacks } = require('../../../middleware');
// 从控制器模块引入用户认证控制器类
const { UserAuthController } = require('../../../controllers');

// 创建用户认证控制器实例，用于处理具体的认证业务逻辑
const userAuthController = new UserAuthController();

// 用户登录路由：处理用户登录请求，验证凭据并返回JWT令牌
router.post('/login', userAuthController.login);

// 用户登出路由：需要认证中间件验证，处理用户登出并使令牌失效
router.post('/logout', stacks.user.authenticated, userAuthController.logout);

// 刷新令牌路由：使用刷新令牌获取新的访问令牌，延长用户会话
router.post('/refresh', userAuthController.refreshToken);

// 用户注册路由：处理新用户注册请求，创建用户账户
router.post('/register', userAuthController.register);

// 获取当前用户信息路由：需要认证，返回当前登录用户的详细信息
router.get('/me', stacks.user.authenticated, userAuthController.getCurrentUser);

// 修改密码路由：需要认证，允许用户修改自己的登录密码
router.put('/password', stacks.user.authenticated, userAuthController.changePassword);

// 验证令牌路由：验证JWT令牌的有效性，用于客户端令牌状态检查
router.get('/verify', userAuthController.verifyToken);

// 导出路由器，供上级路由使用
module.exports = router;
