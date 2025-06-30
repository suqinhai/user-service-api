/**
 * 数据迁移脚本：将枚举值转换为数字
 * 功能：将现有数据库中的字符串枚举值转换为对应的数字值
 * 使用方法：node scripts/migrate-enum-to-numbers.js
 */

const { Sequelize } = require('sequelize');
const { logger } = require('../common/logger');
const { USER_STATUS, USER_ROLE } = require('../common/constants/status');
const { StatusHelper } = require('../common/utils/statusHelper');

// 数据库配置
const sequelize = new Sequelize(
  process.env.DB_NAME || 'express_api',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => logger.info('数据库操作:', msg)
  }
);

/**
 * 迁移用户表的枚举字段
 */
async function migrateUserTable() {
  try {
    logger.info('开始迁移用户表的枚举字段...');
    
    // 获取所有用户记录
    const [users] = await sequelize.query('SELECT id, role, status FROM users');
    
    logger.info(`找到 ${users.length} 条用户记录需要迁移`);
    
    let migratedCount = 0;
    
    for (const user of users) {
      let needUpdate = false;
      const updates = {};
      
      // 迁移角色字段
      if (typeof user.role === 'string') {
        const newRole = StatusHelper.convertLegacyStatus('USER_ROLE', user.role);
        if (newRole !== null) {
          updates.role = newRole;
          needUpdate = true;
          logger.debug(`用户 ${user.id}: 角色 "${user.role}" -> ${newRole}`);
        }
      }
      
      // 迁移状态字段
      if (typeof user.status === 'string') {
        const newStatus = StatusHelper.convertLegacyStatus('USER_STATUS', user.status);
        if (newStatus !== null) {
          updates.status = newStatus;
          needUpdate = true;
          logger.debug(`用户 ${user.id}: 状态 "${user.status}" -> ${newStatus}`);
        }
      }
      
      // 执行更新
      if (needUpdate) {
        const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(updates);
        updateValues.push(user.id);
        
        await sequelize.query(
          `UPDATE users SET ${updateFields} WHERE id = ?`,
          { replacements: updateValues }
        );
        
        migratedCount++;
      }
    }
    
    logger.info(`用户表迁移完成，共更新 ${migratedCount} 条记录`);
    
  } catch (error) {
    logger.error('迁移用户表失败:', error);
    throw error;
  }
}

/**
 * 验证迁移结果
 */
async function validateMigration() {
  try {
    logger.info('开始验证迁移结果...');
    
    // 检查是否还有字符串类型的枚举值
    const [stringRoles] = await sequelize.query(
      "SELECT COUNT(*) as count FROM users WHERE role NOT REGEXP '^[0-9]+$'"
    );
    
    const [stringStatuses] = await sequelize.query(
      "SELECT COUNT(*) as count FROM users WHERE status NOT REGEXP '^[0-9]+$'"
    );
    
    if (stringRoles[0].count > 0) {
      logger.warn(`仍有 ${stringRoles[0].count} 条记录的角色字段为字符串类型`);
    }
    
    if (stringStatuses[0].count > 0) {
      logger.warn(`仍有 ${stringStatuses[0].count} 条记录的状态字段为字符串类型`);
    }
    
    if (stringRoles[0].count === 0 && stringStatuses[0].count === 0) {
      logger.info('迁移验证通过，所有枚举字段已成功转换为数字类型');
    }
    
  } catch (error) {
    logger.error('验证迁移结果失败:', error);
    throw error;
  }
}

/**
 * 备份原始数据
 */
async function backupData() {
  try {
    logger.info('开始备份原始数据...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTableName = `users_backup_${timestamp}`;
    
    await sequelize.query(`CREATE TABLE ${backupTableName} AS SELECT * FROM users`);
    
    logger.info(`数据备份完成，备份表名: ${backupTableName}`);
    
  } catch (error) {
    logger.error('备份数据失败:', error);
    throw error;
  }
}

/**
 * 主迁移函数
 */
async function runMigration() {
  try {
    logger.info('=== 开始数据库枚举到数字迁移 ===');
    
    // 测试数据库连接
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    
    // 备份数据
    await backupData();
    
    // 执行迁移
    await migrateUserTable();
    
    // 验证结果
    await validateMigration();
    
    logger.info('=== 迁移完成 ===');
    
  } catch (error) {
    logger.error('迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  migrateUserTable,
  validateMigration,
  backupData
};
