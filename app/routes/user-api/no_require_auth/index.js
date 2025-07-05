/**
 * H5认证路由
 * 处理H5管理员的认证相关接口
 */

const express = require('express');
const router = express.Router();

// 引入H5中间件和控制器
const { UserAuthController } = require('../../../controllers');

// 创建H5认证控制器实例
const userAuthController = new UserAuthController();

/**
 * H5登录路由
 * POST /api/user/auth/login
 */
router.post('/login', userAuthController.login);

module.exports = router;
