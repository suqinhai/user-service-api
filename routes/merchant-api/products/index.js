// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理商户商品管理相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈，用于认证和权限验证
const { stacks } = require('../../../middleware');
// 从控制器模块引入商户商品控制器类
const { MerchantProductController } = require('../../../controllers');

// 创建商户商品控制器实例，用于处理具体的商品管理业务逻辑
const merchantProductController = new MerchantProductController();

// 获取商户商品列表路由：使用商品专用中间件栈，包含缓存
router.get('/', stacks.merchant.product, merchantProductController.getProducts);

// 获取商品详情路由：需要商户认证和缓存
router.get('/:productId', stacks.merchant.cached, merchantProductController.getProductById);

// 创建商品路由：使用商品专用中间件栈
router.post('/', stacks.merchant.product, merchantProductController.createProduct);

// 更新商品路由：使用商品专用中间件栈
router.put('/:productId', stacks.merchant.product, merchantProductController.updateProduct);

// 删除商品路由：需要敏感操作审计
router.delete('/:productId', stacks.merchant.sensitive, merchantProductController.deleteProduct);

// 批量更新商品状态路由：需要敏感操作审计
router.put('/batch', stacks.merchant.sensitive, merchantProductController.batchUpdateStatus);

// 导出路由器，供上级路由使用
module.exports = router;
