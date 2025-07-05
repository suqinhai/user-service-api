// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理用户认证相关的路由
const router = express.Router();

// 从控制器模块引入用户认证控制器类
const { UserAuthController } = require('../../../controllers');

// 创建用户认证控制器实例，用于处理具体的认证业务逻辑
const userAuthController = new UserAuthController();

router.post('/logout', userAuthController.logout);

// 导出路由器，供上级路由使用
module.exports = router;
