// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理商户端API路由
const router = express.Router();

// 从中间件模块引入商户端专用中间件
const { merchantApi } = require('../../../middleware');

// 将商户端基础中间件应用到所有子路由，包括认证、权限验证等
router.use(merchantApi);

// 引入商户登录路由模块（需要在认证中间件之前注册，因为登录接口本身不需要认证）
const loginRouter = require('./no_require_auth/index'); // 总台认证路由

// 注册总台认证路由，路径为/api/admin/auth（无需认证的公开路由）
router.use('/auth', loginRouter);

// 引入商户端子路由模块
const authRouter = require('./auth');        // 商户认证路由

// 注册子路由到对应的路径
router.use('/auth', authRouter);      // 注册认证路由，路径为/api/merchant/auth

// 导出路由器，供上级路由使用
module.exports = router;
