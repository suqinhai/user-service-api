// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理商户端API路由
const router = express.Router();

// 商户端API根路由处理函数，返回API服务状态和可用端点信息
router.get('/', function(req, res) {
  // 使用统一的成功响应方法返回商户端API信息
  res.sendSuccess('商户端API服务正常', {
    data: {
      type: 'merchant',  // API类型标识
      description: '商户端接口，提供商户相关功能',  // API描述
      // 列出所有可用的商户端API端点
      availableEndpoints: [
        '/api/merchant/auth',     // 商户认证相关接口
        '/api/merchant/shop',     // 店铺管理相关接口
        '/api/merchant/products'  // 商品管理相关接口
      ]
    }
  });
});

// 从中间件模块引入商户端专用中间件
const { merchantApi } = require('../../middleware');

// 将商户端基础中间件应用到所有子路由，包括认证、权限验证等
router.use(merchantApi);

// 引入商户端子路由模块
const authRouter = require('./auth');        // 商户认证路由
const shopRouter = require('./shop');        // 店铺管理路由
const productsRouter = require('./products'); // 商品管理路由

// 注册子路由到对应的路径
router.use('/auth', authRouter);      // 注册认证路由，路径为/api/merchant/auth
router.use('/shop', shopRouter);      // 注册店铺路由，路径为/api/merchant/shop
router.use('/products', productsRouter); // 注册商品路由，路径为/api/merchant/products

// 导出路由器，供上级路由使用
module.exports = router;
