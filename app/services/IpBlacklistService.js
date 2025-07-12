const BaseService = require('./BaseService');
const { IpBlacklist } = require('../models');

class IpBlacklistService extends BaseService {
  /**
   * 获取IP黑名单列表
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 分页结果
   */
  async getIpBlacklist({ merchantId, page = 1, limit = 10, ip, status }) {
    const query = { merchantId };
    
    if (ip) {
      query.ip = { $regex: ip, $options: 'i' };
    }
    
    if (status !== undefined) {
      query.status = status;
    }
    
    const total = await IpBlacklist.countDocuments(query);
    const list = await IpBlacklist.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('operator', 'username name')
      .lean();
    
    return {
      list,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 添加IP到黑名单
   * @param {Object} data IP黑名单数据
   * @returns {Promise<Object>} 创建的黑名单记录
   */
  async addIpToBlacklist({ merchantId, ip, remark, status, operatorId }) {
    // 检查IP是否已存在
    const existing = await IpBlacklist.findOne({ merchantId, ip });
    if (existing) {
      throw new Error('该IP已在黑名单中');
    }
    
    const blacklistItem = new IpBlacklist({
      merchantId,
      ip,
      remark,
      status,
      operator: operatorId
    });
    
    await blacklistItem.save();
    return blacklistItem;
  }

  /**
   * 批量删除IP黑名单
   * @param {string} merchantId 商户ID
   * @param {Array<string>} ids 要删除的记录ID数组
   * @returns {Promise<Object>} 删除结果
   */
  async removeIpsFromBlacklist(merchantId, ids) {
    const result = await IpBlacklist.deleteMany({
      merchantId,
      _id: { $in: ids }
    });
    
    return { deletedCount: result.deletedCount };
  }

  /**
   * 更新IP黑名单项
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的记录
   */
  async updateIpBlacklistItem({ id, merchantId, ip, remark, status, operatorId }) {
    const updateData = {};
    
    if (ip !== undefined) {
      // 检查新IP是否与其他记录冲突
      const existing = await IpBlacklist.findOne({ 
        merchantId, 
        ip, 
        _id: { $ne: id } 
      });
      
      if (existing) {
        throw new Error('该IP已在黑名单中');
      }
      
      updateData.ip = ip;
    }
    
    if (remark !== undefined) updateData.remark = remark;
    if (status !== undefined) updateData.status = status;
    
    updateData.operator = operatorId;
    updateData.updatedAt = new Date();
    
    const updated = await IpBlacklist.findOneAndUpdate(
      { _id: id, merchantId },
      { $set: updateData },
      { new: true }
    ).populate('operator', 'username name');
    
    if (!updated) {
      throw new Error('记录不存在或无权限修改');
    }
    
    return updated;
  }
}

module.exports = IpBlacklistService;
