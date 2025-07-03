/**
 * 总台认证路由
 * 处理总台管理员的认证相关接口
 */

const express = require('express');
const router = express.Router();

// 引入总台中间件和控制器
const { AdminAuthController } = require('../../../controllers');

// 创建总台认证控制器实例
const adminAuthController = new AdminAuthController();

/**
 * 总台登录路由
 * POST /api/admin/auth/login
 */
router.post('/login', adminAuthController.login);

module.exports = router;
