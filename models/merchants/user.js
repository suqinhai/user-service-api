const { DataTypes } = require('sequelize');
const { USER_ROLE, USER_STATUS } = require('../../common/constants/status');

module.exports = (sequelize) => {
  const MerchantsUsers = sequelize.define('MerchantsUsers', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.INTEGER,
      defaultValue: USER_ROLE.USER,
      allowNull: false,
      comment: '用户角色(0:普通用户,1:管理员,2:超级管理员,3:版主)'
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: USER_STATUS.ACTIVE,
      comment: '用户状态(0:未激活,1:已激活,2:已暂停,3:已封禁,4:已删除)'
    },
    last_login: {
      type: DataTypes.DATE
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'merchants_users',
    timestamps: false
  });

  return MerchantsUsers;
}; 