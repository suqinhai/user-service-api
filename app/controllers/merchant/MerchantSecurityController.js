const BaseController = require('../base/BaseController');
const { IpBlacklistService } = require('../../services');

class MerchantSecurityController extends BaseController {
  constructor() {
    super();
    this.ipBlacklistService = new IpBlacklistService();
  }

  /**
   * 获取商户IP黑名单列表
   * GET /api/merchant/security/ip-blacklist
   */
  getIpBlacklist = this.asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      ip, 
      status,
      restrictType 
    } = req.query;
    
    const merchantId = req.merchantId;
    
    const result = await this.ipBlacklistService.getIpBlacklist({
      merchantId,
      page: parseInt(page),
      limit: parseInt(limit),
      ip,
      status: status !== undefined ? parseInt(status) : undefined,
      restrictType: restrictType !== undefined ? parseInt(restrictType) : undefined
    });
    
    return this.sendSuccess(res, '获取IP黑名单成功', result);
  });

  /**
   * 添加IP到黑名单
   * POST /api/merchant/security/ip-blacklist
   */
  addIpToBlacklist = this.asyncHandler(async (req, res) => {
    const { 
      ip, 
      remark, 
      status, 
      restrictType,
      relatedAccounts 
    } = req.body;
    
    const merchantId = req.merchantId;
    
    // 验证IP格式
    if (!this.validateIpAddress(ip)) {
      return this.sendError(res, 'IP地址格式不正确', 400);
    }
    
    // 验证限制类型
    if (restrictType && ![1, 2, 3].includes(parseInt(restrictType))) {
      return this.sendError(res, '限制类型不正确', 400);
    }
    
    const result = await this.ipBlacklistService.addIpToBlacklist({
      merchantId,
      ip,
      remark,
      status: status || 1,
      restrictType: restrictType || 3,
      relatedAccounts,
      operatorId: req.user.id
    });
    
    return this.sendSuccess(res, '添加IP黑名单成功', result);
  });

  /**
   * 批量删除IP黑名单
   * DELETE /api/merchant/security/ip-blacklist
   */
  removeIpsFromBlacklist = this.asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const merchantId = req.merchantId;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return this.sendError(res, '请选择要删除的记录', 400);
    }
    
    await this.ipBlacklistService.removeIpsFromBlacklist(merchantId, ids);
    
    return this.sendSuccess(res, '删除IP黑名单成功');
  });

  /**
   * 更新IP黑名单项
   * PUT /api/merchant/security/ip-blacklist/:id
   */
  updateIpBlacklistItem = this.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      ip, 
      remark, 
      status,
      restrictType,
      relatedAccounts 
    } = req.body;
    
    const merchantId = req.merchantId;
    
    // 验证IP格式
    if (ip && !this.validateIpAddress(ip)) {
      return this.sendError(res, 'IP地址格式不正确', 400);
    }
    
    // 验证限制类型
    if (restrictType && ![1, 2, 3].includes(parseInt(restrictType))) {
      return this.sendError(res, '限制类型不正确', 400);
    }
    
    const result = await this.ipBlacklistService.updateIpBlacklistItem({
      id,
      merchantId,
      ip,
      remark,
      status,
      restrictType,
      relatedAccounts,
      operatorId: req.user.id
    });
    
    return this.sendSuccess(res, '更新IP黑名单成功', result);
  });

  /**
   * 获取IP关联的账号列表
   * GET /api/merchant/security/ip-blacklist/:id/accounts
   */
  getRelatedAccounts = this.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const merchantId = req.merchantId;
    
    const accounts = await this.ipBlacklistService.getRelatedAccounts(merchantId, id);
    
    return this.sendSuccess(res, '获取关联账号成功', accounts);
  });

  /**
   * 添加关联账号到IP黑名单
   * POST /api/merchant/security/ip-blacklist/:id/accounts
   */
  addRelatedAccount = this.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId, username } = req.body;
    const merchantId = req.merchantId;
    
    if (!userId || !username) {
      return this.sendError(res, '用户ID和用户名不能为空', 400);
    }
    
    const result = await this.ipBlacklistService.addRelatedAccount(
      merchantId, 
      id, 
      { userId, username }
    );
    
    return this.sendSuccess(res, '添加关联账号成功', result);
  });

  /**
   * 移除IP黑名单中的关联账号
   * DELETE /api/merchant/security/ip-blacklist/:id/accounts/:accountId
   */
  removeRelatedAccount = this.asyncHandler(async (req, res) => {
    const { id, accountId } = req.params;
    const merchantId = req.merchantId;
    
    await this.ipBlacklistService.removeRelatedAccount(merchantId, id, accountId);
    
    return this.sendSuccess(res, '移除关联账号成功');
  });

  /**
   * 验证IP地址格式
   * @private
   */
  validateIpAddress(ip) {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipv4Regex.test(ip)) return false;
    
    const parts = ip.split('.').map(part => parseInt(part, 10));
    return parts.every(part => part >= 0 && part <= 255);
  }
}

module.exports = MerchantSecurityController;

