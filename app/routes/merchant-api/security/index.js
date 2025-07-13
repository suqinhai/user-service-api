const express = require('express');
const router = express.Router();
const { stacks } = require('../../../../middleware');
const { MerchantSecurityController } = require('../../../controllers');

const merchantSecurityController = new MerchantSecurityController();

// 获取IP黑名单列表
router.get('/ip-blacklist', stacks.merchant.authenticated, merchantSecurityController.getIpBlacklist);

// 添加IP到黑名单
router.post('/ip-blacklist', stacks.merchant.sensitive, merchantSecurityController.addIpToBlacklist);

// 批量删除IP黑名单
router.delete('/ip-blacklist', stacks.merchant.sensitive, merchantSecurityController.removeIpsFromBlacklist);

// 更新IP黑名单项
router.put('/ip-blacklist/:id', stacks.merchant.sensitive, merchantSecurityController.updateIpBlacklistItem);

// 获取IP关联的账号列表
router.get('/ip-blacklist/:id/accounts', stacks.merchant.authenticated, merchantSecurityController.getRelatedAccounts);

// 添加关联账号到IP黑名单
router.post('/ip-blacklist/:id/accounts', stacks.merchant.sensitive, merchantSecurityController.addRelatedAccount);

// 移除IP黑名单中的关联账号
router.delete('/ip-blacklist/:id/accounts/:accountId', stacks.merchant.sensitive, merchantSecurityController.removeRelatedAccount);

module.exports = router;



