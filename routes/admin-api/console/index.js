/**
 * 总台认证路由
 * 处理总台管理员的认证相关接口
 */

const express = require('express');
const router = express.Router();

// 引入总台中间件和控制器
const { stacks } = require('../../../middleware/api/console');
const { ConsoleAuthController } = require('../../../controllers');

// 创建总台认证控制器实例
const consoleAuthController = new ConsoleAuthController();

/**
 * 总台登录路由
 * POST /api/admin/console/auth/login
 * 
 * 请求体参数:
 * - username: 总台管理员用户名
 * - password: 密码
 * 
 * 响应:
 * - 成功: 返回用户信息和JWT令牌
 * - 失败: 返回错误信息和剩余尝试次数
 */
router.post('/login', stacks.login, consoleAuthController.login);

/**
 * 总台登出路由
 * POST /api/admin/console/auth/logout
 * 需要总台认证
 */
router.post('/logout', stacks.authenticated, consoleAuthController.logout);

/**
 * 刷新总台令牌路由
 * POST /api/admin/console/auth/refresh
 * 
 * 请求体参数:
 * - refreshToken: 刷新令牌
 */
router.post('/refresh', consoleAuthController.refreshToken);

/**
 * 验证总台令牌路由
 * GET /api/admin/console/auth/verify
 * 
 * 请求头:
 * - Authorization: Bearer <token>
 */
router.get('/verify', consoleAuthController.verifyToken);

/**
 * 获取总台登录状态路由
 * GET /api/admin/console/auth/status/:username
 * 需要总台认证
 * 
 * 路径参数:
 * - username: 要查询的用户名
 */
router.get('/status/:username', stacks.authenticated, consoleAuthController.getLoginStatus);

/**
 * 获取当前总台用户信息路由
 * GET /api/admin/console/auth/me
 * 需要总台认证
 */
router.get('/me', stacks.authenticated, consoleAuthController.getCurrentUser);

module.exports = router;
