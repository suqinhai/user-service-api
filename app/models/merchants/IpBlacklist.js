const { DataTypes } = require('sequelize');

/**
 * IP黑名单模型
 */
module.exports = (sequelize) => {
  const IpBlacklist = sequelize.define('IpBlacklist', {
    // 主键ID
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // 所属商户ID
    merchantId: {
      type: DataTypes.STRING(24),
      allowNull: false
    },
    
    // IP地址
    ip: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    
    // 限制类型: 1-登录限制, 2-注册限制, 3-全部限制
    restrictType: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
      validate: {
        isIn: [[1, 2, 3]]
      }
    },
    
    // 关联账号列表 (JSON格式存储)
    relatedAccounts: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    // 关联账号数量
    accountCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // 备注说明
    remark: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    
    // 状态: 1-启用, 0-禁用
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]]
      }
    },
    
    // 操作人ID - 不使用外键约束，避免同步问题
    operator: {
      type: DataTypes.STRING(24),
      allowNull: false
    }
  }, {
    tableName: 'ip_blacklist',
    timestamps: true,
    indexes: [
      // 创建复合唯一索引
      {
        unique: true,
        fields: ['merchantId', 'ip']
      },
      // 为操作人创建索引
      {
        fields: ['operator']
      }
    ]
  });

  return IpBlacklist;
};
