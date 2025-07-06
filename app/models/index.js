const { sequelize } = require('../../common/index');
const userModel = require('./users/user');
const merchantUserModel = require('./merchants/user');

// 初始化模型
const models = {
  userModel: userModel(sequelize),
  merchantUserModel: merchantUserModel(sequelize),
};

// 导出模型和 Sequelize 实例
module.exports = {
  ...models,
  sequelize,
};
