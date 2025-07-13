const { sequelize, sequelizeUser } = require('../../common/index');
const userModel = require('./users/user');
const IpBlacklistModel = require('./merchants/IpBlacklist');
const merchantUserModel = require('./merchants/user');
// const enhancedUserModel = require('./users/enhancedUser');

// 初始化模型
const models = {
  merchantUserModel: merchantUserModel(sequelize),
  IpBlacklistModel: IpBlacklistModel(sequelize),
};

const modelsUser = {
  userModel: userModel(sequelizeUser),
  // enhancedUserModel: enhancedUserModel(sequelizeUser),
};

// 设置模型关联
// IpBlacklist与User的关联(操作人) - 使用非外键关联
if (models.IpBlacklistModel && modelsUser.userModel) {
  // 使用非外键关联，避免同步问题
  models.IpBlacklistModel.belongsTo(modelsUser.userModel, {
    foreignKey: 'operator',
    as: 'operatorUser',
    constraints: false // 禁用外键约束
  });
}

// 导出模型和 Sequelize 实例
module.exports = {
  ...models,
  ...modelsUser,
  sequelize,
  sequelizeUser,
};
