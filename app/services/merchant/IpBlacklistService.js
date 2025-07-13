const BaseService = require('../base/BaseService');
const { IpBlacklistModel } = require('../../models');
const { Op } = require('sequelize');

class IpBlacklistService extends BaseService {
  /**
   * 获取IP黑名单列表
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 分页结果
   */
  async getIpBlacklist({ merchantId, page = 1, limit = 10, ip, status, restrictType }) {
    const query = { merchantId };
    
    if (ip) {
      query.ip = { [Op.like]: `%${ip}%` };
    }
    
    if (status !== undefined) {
      query.status = status;
    }
    
    if (restrictType !== undefined) {
      query.restrictType = restrictType;
    }
    
    const { count, rows } = await IpBlacklistModel.findAndCountAll({
      where: query,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
      include: [{
        association: 'operatorUser',
        attributes: ['username', 'name']
      }]
    });
    
    return {
      list: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * 添加IP到黑名单
   * @param {Object} data IP黑名单数据
   * @returns {Promise<Object>} 创建的黑名单记录
   */
  async addIpToBlacklist({ merchantId, ip, remark, status, restrictType, relatedAccounts, operatorId }) {
    // 检查IP是否已存在
    const existing = await IpBlacklistModel.findOne({ 
      where: { merchantId, ip }
    });
    
    if (existing) {
      throw new Error('该IP已在黑名单中');
    }
    
    // 处理关联账号
    let accounts = [];
    let accountCount = 0;
    
    if (Array.isArray(relatedAccounts) && relatedAccounts.length > 0) {
      accounts = relatedAccounts.map(account => ({
        userId: account.userId,
        username: account.username,
        addedAt: new Date()
      }));
      accountCount = accounts.length;
    }
    
    const blacklistItem = await IpBlacklistModel.create({
      merchantId,
      ip,
      remark,
      status,
      restrictType,
      relatedAccounts: accounts,
      accountCount,
      operator: operatorId
    });
    
    return blacklistItem;
  }

  /**
   * 批量删除IP黑名单
   * @param {string} merchantId 商户ID
   * @param {Array<string>} ids 要删除的记录ID数组
   * @returns {Promise<Object>} 删除结果
   */
  async removeIpsFromBlacklist(merchantId, ids) {
    const result = await IpBlacklistModel.destroy({
      where: {
        merchantId,
        id: { [Op.in]: ids }
      }
    });
    
    return { deletedCount: result };
  }

  /**
   * 更新IP黑名单项
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的记录
   */
  async updateIpBlacklistItem({ id, merchantId, ip, remark, status, restrictType, relatedAccounts, operatorId }) {
    const updateData = {};
    
    if (ip !== undefined) {
      // 检查新IP是否与其他记录冲突
      const existing = await IpBlacklistModel.findOne({ 
        where: { 
          merchantId, 
          ip, 
          id: { [Op.ne]: id } 
        }
      });
      
      if (existing) {
        throw new Error('该IP已在黑名单中');
      }
      
      updateData.ip = ip;
    }
    
    if (remark !== undefined) updateData.remark = remark;
    if (status !== undefined) updateData.status = status;
    if (restrictType !== undefined) updateData.restrictType = restrictType;
    
    // 处理关联账号
    if (Array.isArray(relatedAccounts)) {
      updateData.relatedAccounts = relatedAccounts.map(account => ({
        userId: account.userId,
        username: account.username,
        addedAt: account.addedAt || new Date()
      }));
      updateData.accountCount = relatedAccounts.length;
    }
    
    updateData.operator = operatorId;
    updateData.updatedAt = new Date();
    
    const [updated] = await IpBlacklistModel.update(updateData, {
      where: { id, merchantId },
      returning: true
    });
    
    if (!updated) {
      throw new Error('记录不存在或无权限修改');
    }
    
    return await IpBlacklistModel.findByPk(id, {
      include: [{
        association: 'operatorUser',
        attributes: ['username', 'name']
      }]
    });
  }

  /**
   * 获取IP关联的账号列表
   * @param {string} merchantId 商户ID
   * @param {string} id IP黑名单ID
   * @returns {Promise<Array>} 关联账号列表
   */
  async getRelatedAccounts(merchantId, id) {
    const blacklist = await IpBlacklistModel.findOne({ 
      where: { id, merchantId },
      attributes: ['relatedAccounts']
    });
    
    if (!blacklist) {
      throw new Error('记录不存在或无权限查看');
    }
    
    return blacklist.relatedAccounts || [];
  }

  /**
   * 添加关联账号到IP黑名单
   * @param {string} merchantId 商户ID
   * @param {string} id IP黑名单ID
   * @param {Object} account 账号信息
   * @returns {Promise<Object>} 更新后的记录
   */
  async addRelatedAccount(merchantId, id, account) {
    const blacklist = await IpBlacklistModel.findOne({ 
      where: { id, merchantId }
    });
    
    if (!blacklist) {
      throw new Error('记录不存在或无权限修改');
    }
    
    // 获取当前关联账号
    const relatedAccounts = blacklist.relatedAccounts || [];
    
    // 检查账号是否已存在
    const exists = relatedAccounts.some(
      a => a.userId === account.userId
    );
    
    if (exists) {
      throw new Error('该账号已关联到此IP');
    }
    
    // 添加新账号
    const newAccount = {
      userId: account.userId,
      username: account.username,
      addedAt: new Date()
    };
    
    relatedAccounts.push(newAccount);
    
    const updated = await IpBlacklistModel.update({
      relatedAccounts,
      accountCount: relatedAccounts.length,
      updatedAt: new Date()
    }, {
      where: { id, merchantId }
    });
    
    return await IpBlacklistModel.findByPk(id);
  }

  /**
   * 移除IP黑名单中的关联账号
   * @param {string} merchantId 商户ID
   * @param {string} id IP黑名单ID
   * @param {string} accountId 关联账号ID
   * @returns {Promise<Object>} 更新后的记录
   */
  async removeRelatedAccount(merchantId, id, accountId) {
    const blacklist = await IpBlacklistModel.findOne({ 
      where: { id, merchantId }
    });
    
    if (!blacklist) {
      throw new Error('记录不存在或无权限修改');
    }
    
    // 获取当前关联账号并过滤掉要删除的账号
    const relatedAccounts = (blacklist.relatedAccounts || [])
      .filter(account => account.userId !== accountId);
    
    await IpBlacklistModel.update({
      relatedAccounts,
      accountCount: relatedAccounts.length,
      updatedAt: new Date()
    }, {
      where: { id, merchantId }
    });
    
    return await IpBlacklistModel.findByPk(id);
  }
}

module.exports = IpBlacklistService;



