#!/usr/bin/env node

/**
 * 数据库同步脚本
 * 
 * 此脚本用于将模型定义同步到数据库，创建或更新表结构
 * 使用方法: node scripts/sync-db.js [--force] [--alter]
 * 
 * 参数:
 *   --force: 强制重建表 (危险: 会删除现有数据)
 *   --alter: 使用 ALTER 语句修改表结构 (保留数据)
 */

const { sequelize } = require('../common');
const models = require('../app/models');
const { logger } = require('../common/logger');

// 解析命令行参数
const args = process.argv.slice(2);
const force = args.includes('--force');
const alter = !force && args.includes('--alter');

// 同步选项
const syncOptions = {
  force: force,
  alter: alter,
  logging: console.log
};

async function syncDatabase() {
  try {
    logger.info('开始同步数据库结构...');
    
    if (force) {
      logger.warn('警告: 使用 force 模式将删除所有现有数据!');
      // 确认提示在生产环境
      if (process.env.NODE_ENV === 'production') {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question('您正在生产环境中使用 force 模式，这将删除所有数据。确定要继续吗? (y/N): ', resolve);
        });
        
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
          logger.info('操作已取消');
          process.exit(0);
        }
      }
    }

    // 同步所有模型到数据库
    await sequelize.sync(syncOptions);
    
    logger.info('数据库同步完成!');
    
    if (force) {
      logger.info('所有表已重建');
    } else if (alter) {
      logger.info('表结构已更新');
    } else {
      logger.info('仅创建不存在的表');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('数据库同步失败:', error);
    process.exit(1);
  }
}

// 执行同步
syncDatabase();