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

// 导出模型和 Sequelize 实例
module.exports = {
  ...models,
  ...modelsUser,
  sequelize,
  sequelizeUser,
};
