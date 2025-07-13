const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * IP黑名单模型
 */
const IpBlacklistSchema = new Schema({
  // 所属商户ID
  merchantId: {
    type: Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true
  },
  
  // IP地址
  ip: {
    type: String,
    required: true,
    trim: true
  },
  
  // 限制类型: 1-登录限制, 2-注册限制, 3-全部限制
  restrictType: {
    type: Number,
    default: 3,
    enum: [1, 2, 3],
    required: true
  },
  
  // 关联账号列表
  relatedAccounts: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'MerchantsUsers'
    },
    username: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // 关联账号数量
  accountCount: {
    type: Number,
    default: 0
  },
  
  // 备注说明
  remark: {
    type: String,
    default: ''
  },
  
  // 状态: 1-启用, 0-禁用
  status: {
    type: Number,
    default: 1,
    enum: [0, 1]
  },
  
  // 操作人
  operator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // 更新时间
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 创建复合索引
IpBlacklistSchema.index({ merchantId: 1, ip: 1 }, { unique: true });

module.exports = mongoose.model('IpBlacklist', IpBlacklistSchema);

