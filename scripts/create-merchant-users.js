const bcrypt = require('bcrypt');
const { sequelize } = require('../common');
const { USER_ROLE } = require('../common/constants/status');
const MerchantsUserModel = require('../app/models/merchants/user')(sequelize);

async function createMerchantUsers() {
  try {
    // 加密密码
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // 创建商户用户
    await MerchantsUserModel.create({
      username: 'admin_merchant',
      password: hashedPassword,
      email: 'merchant@example.com',
      role: USER_ROLE.MERCHANT, // 20: 商户
      status: 1
    });
    
    // 创建总台管理员
    await MerchantsUserModel.create({
      username: 'admin_console',
      password: hashedPassword,
      email: 'console@example.com',
      role: USER_ROLE.CONSOLE_ADMIN, // 30: 总台管理员
      status: 1
    });
    
    console.log('商户用户和总台管理员创建成功');
    process.exit(0);
  } catch (error) {
    console.error('创建用户失败:', error);
    process.exit(1);
  }
}

createMerchantUsers();