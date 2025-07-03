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

// 导出路由器，供上级路由使用
module.exports = router;
