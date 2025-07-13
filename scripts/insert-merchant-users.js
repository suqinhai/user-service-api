const { sequelize } = require('../common');
const bcrypt = require('bcrypt');
const { USER_ROLE } = require('../common/constants/status');

async function insertUsers() {
  try {
    // 先测试数据库连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // 检查表是否存在
    const tables = await sequelize.query(`SHOW TABLES LIKE 'merchants_users'`);
    if (tables[0].length === 0) {
      console.error('表 merchants_users 不存在');
      process.exit(1);
    }
    
    // 使用原始SQL查询插入数据
    await sequelize.query(`
      INSERT INTO merchants_users 
      (username, password, email, login_count, role, status, created_at, updated_at) 
      VALUES 
      ('admin', '${hashedPassword}', 'admin@example.com', 0, ${USER_ROLE.MERCHANT}, 1, NOW(), NOW()),
      ('admin_console', '${hashedPassword}', 'admin_console@example.com', 0, ${USER_ROLE.CONSOLE_ADMIN}, 1, NOW(), NOW())
    `);
    
    console.log('用户创建成功');
    process.exit(0);
  } catch (error) {
    console.error('创建用户失败:', error);
    // 输出更详细的错误信息
    if (error.parent) {
      console.error('SQL错误:', error.parent);
    }
    process.exit(1);
  }
}

// 确保在执行前连接数据库
sequelize.authenticate()
  .then(() => {
    console.log('数据库连接成功，开始插入用户');
    insertUsers();
  })
  .catch(err => {
    console.error('数据库连接失败:', err);
    process.exit(1);
  });
