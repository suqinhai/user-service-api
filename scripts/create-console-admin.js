/**
 * 创建总台管理员用户脚本
 * 用于初始化总台管理员账号
 */

const bcrypt = require('bcrypt');
const { sequelize } = require('../common/mysql');
const { USER_ROLE, USER_STATUS } = require('../common/constants/status');

/**
 * 创建总台管理员用户
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} email - 邮箱
 * @returns {Promise<Object>} 创建结果
 */
async function createConsoleAdmin(username, password, email) {
  try {
    console.log('开始创建总台管理员用户...');

    // 检查用户是否已存在
    const User = sequelize.models.User;
    const existingUser = await User.findOne({
      where: { username }
    });

    if (existingUser) {
      console.log(`用户 ${username} 已存在`);
      
      // 如果用户存在但不是总台管理员，更新其角色
      if (existingUser.role !== USER_ROLE.CONSOLE_ADMIN) {
        await existingUser.update({
          role: USER_ROLE.CONSOLE_ADMIN,
          status: USER_STATUS.ACTIVE
        });
        console.log(`用户 ${username} 已更新为总台管理员`);
        return {
          success: true,
          message: '用户角色已更新为总台管理员',
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role
          }
        };
      } else {
        console.log(`用户 ${username} 已经是总台管理员`);
        return {
          success: true,
          message: '用户已经是总台管理员',
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role
          }
        };
      }
    }

    // 加密密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建新用户
    const newUser = await User.create({
      username,
      password: hashedPassword,
      email,
      role: USER_ROLE.CONSOLE_ADMIN,
      status: USER_STATUS.ACTIVE,
      created_at: new Date()
    });

    console.log(`总台管理员用户 ${username} 创建成功`);
    console.log(`用户ID: ${newUser.id}`);
    console.log(`角色: ${newUser.role} (总台管理员)`);

    return {
      success: true,
      message: '总台管理员用户创建成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    };

  } catch (error) {
    console.error('创建总台管理员用户失败:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 从命令行参数获取用户信息
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.log('使用方法: node create-console-admin.js <username> <password> <email>');
      console.log('示例: node create-console-admin.js console_admin admin123456 console@example.com');
      process.exit(1);
    }

    const [username, password, email] = args;

    // 验证参数
    if (!username || username.length < 3) {
      throw new Error('用户名至少需要3个字符');
    }

    if (!password || password.length < 6) {
      throw new Error('密码至少需要6个字符');
    }

    if (!email || !email.includes('@')) {
      throw new Error('请提供有效的邮箱地址');
    }

    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 同步数据库模型
    await sequelize.sync();
    console.log('数据库模型同步完成');

    // 创建总台管理员
    const result = await createConsoleAdmin(username, password, email);
    
    console.log('\n=== 创建结果 ===');
    console.log(`状态: ${result.success ? '成功' : '失败'}`);
    console.log(`消息: ${result.message}`);
    console.log(`用户信息:`, result.user);

    console.log('\n=== 登录信息 ===');
    console.log(`登录地址: POST /api/admin/console/auth/login`);
    console.log(`用户名: ${username}`);
    console.log(`密码: ${password}`);
    console.log(`角色: 总台管理员 (${USER_ROLE.CONSOLE_ADMIN})`);

  } catch (error) {
    console.error('脚本执行失败:', error.message);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
    console.log('\n数据库连接已关闭');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  createConsoleAdmin
};
