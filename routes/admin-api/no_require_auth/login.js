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

module.exports = router;
