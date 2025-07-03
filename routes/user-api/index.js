// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理用户端API路由
const router = express.Router();

// 从中间件模块引入用户端专用中间件
const { userApi } = require('../../middleware');

// 将用户端基础中间件应用到所有子路由，包括认证、权限验证等
router.use(userApi);

// 引入用户端子路由模块
const authRouter = require('./auth');        // 用户认证路由

// 注册子路由到对应的路径
router.use('/auth', authRouter);      // 注册认证路由，路径为/api/user/auth

// 导出路由器，供上级路由使用
module.exports = router;
