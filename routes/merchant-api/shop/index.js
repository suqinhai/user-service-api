// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理商户店铺管理相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈，用于认证和权限验证
const { stacks } = require('../../../middleware');
// 从控制器模块引入商户店铺控制器类
const { MerchantShopController } = require('../../../controllers');

// 创建商户店铺控制器实例，用于处理具体的店铺管理业务逻辑
const merchantShopController = new MerchantShopController();

// 获取商户店铺列表路由：需要商户认证，返回当前商户的所有店铺
router.get('/', stacks.merchant.cached, merchantShopController.getShops);

// 获取店铺详情路由：需要店铺访问权限验证
router.get('/:shopId', stacks.merchant.shopAccess, merchantShopController.getShopById);

// 创建店铺路由：需要商户认证，创建新的店铺
router.post('/', stacks.merchant.authenticated, merchantShopController.createShop);

// 更新店铺路由：需要店铺访问权限验证
router.put('/:shopId', stacks.merchant.shopAccess, merchantShopController.updateShop);

// 删除店铺路由：需要店铺访问权限验证和敏感操作审计
router.delete('/:shopId', stacks.merchant.sensitive, merchantShopController.deleteShop);

// 导出路由器，供上级路由使用
module.exports = router;
