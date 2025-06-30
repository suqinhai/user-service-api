const { sequelize } = require('../common/index');
const userModel = require('../models/user');
const registerConfigModelDefinition = require('../models/users/registerConfig');

async function syncDatabase() {
  try {
    // 初始化用户模型
    const User = userModel(sequelize);

    // 同步模型到数据库（创建表）
    // force: true 表示如果表已存在则先删除再创建
    await User.sync({ force: true });
    console.log('用户表创建成功');

    // 创建一个测试用户
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('123456', saltRounds);

    await User.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log('测试用户创建成功');
    console.log('用户名: admin');
    console.log('密码: 123456');

  } catch (error) {
    console.error('数据库同步失败:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 执行同步
syncDatabase(); 