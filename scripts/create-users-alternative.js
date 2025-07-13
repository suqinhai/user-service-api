const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// 直接从环境变量获取数据库配置
const config = {
  dialect: process.env.DB_DIALECT || 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '123456',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'playcore',
  logging: console.log
};

// 创建新的Sequelize实例
const sequelize = new Sequelize(config);

// 用户角色常量
const USER_ROLE = {
  MERCHANT: 20,
  CONSOLE_ADMIN: 30
};

async function createUsers() {
  try {
    // 测试连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // 使用原始SQL查询
    await sequelize.query(`
      INSERT INTO merchants_users 
      (username, password, email, login_count, role, status, created_at, updated_at) 
      VALUES 
      ('admin', '${hashedPassword}', 'admin@example.com', 0, ${USER_ROLE.MERCHANT}, 1, NOW(), NOW()),
      ('admin_console', '${hashedPassword}', 'admin_console@example.com', 0, ${USER_ROLE.CONSOLE_ADMIN}, 1, NOW(), NOW())
    `);
    
    console.log('用户创建成功');
  } catch (error) {
    console.error('创建用户失败:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

createUsers();