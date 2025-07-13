/**
 * 商户认证路由
 * 处理商户管理员的认证相关接口
 */

const express = require('express');
const router = express.Router();

// 引入商户中间件和控制器
const { MerchantAuthController } = require('../../../controllers');
const { stacks } = require('../../../../middleware');
// 创建商户认证控制器实例
const merchantAuthController = new MerchantAuthController();

/**
 * 商户登录路由
 * POST /api/admin/auth/login
 */
router.post('/login', stacks.merchant.login, merchantAuthController.login);

module.exports = router;
