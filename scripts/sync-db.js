#!/usr/bin/env node

/**
 * 数据库同步脚本
 * 
 * 此脚本用于将所有模型定义同步到数据库，创建或更新表结构
 * 支持 Sequelize (SQL) 和 Mongoose (MongoDB) 模型
 * 
 * 使用方法: node scripts/sync-db.js [--force] [--alter] [--mongo] [--sql]
 * 
 * 参数:
 *   --force: 强制重建表 (危险: 会删除现有数据)
 *   --alter: 使用 ALTER 语句修改表结构 (保留数据)
 *   --mongo: 只同步 MongoDB 模型
 *   --sql: 只同步 SQL 模型
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { sequelize, sequelizeUser } = require('../common');
const { logger } = require('../common/logger');
// 直接导入所有模型，确保它们被正确加载
const models = require('../app/models');

// 解析命令行参数
const args = process.argv.slice(2);
const force = args.includes('--force');
const alter = !force && args.includes('--alter');
const mongoOnly = args.includes('--mongo');
const sqlOnly = args.includes('--sql');

// 同步选项
const syncOptions = {
  force: force,
  alter: alter,
  logging: console.log
};

async function syncSequelizeDatabase() {
  if (sqlOnly || !mongoOnly) {
    try {
      logger.info('开始同步 SQL 数据库结构...');
      
      // 获取所有已加载的 Sequelize 模型
      const sequelizeModels = Object.values(sequelize.models);
      const sequelizeUserModels = Object.values(sequelizeUser.models);
      
      logger.info(`共发现 ${sequelizeModels.length} 个主数据库模型和 ${sequelizeUserModels.length} 个用户数据库模型需要同步`);
      
      if (sequelizeModels.length > 0 || sequelizeUserModels.length > 0) {
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
              return;
            }
          }
        }

        // 同步所有模型到数据库
        if (sequelizeModels.length > 0) {
          await sequelize.sync(syncOptions);
          logger.info('主数据库同步完成!');
        }
        
        if (sequelizeUserModels.length > 0) {
          await sequelizeUser.sync(syncOptions);
          logger.info('用户数据库同步完成!');
        }
        
        if (force) {
          logger.info('所有表已重建');
        } else if (alter) {
          logger.info('表结构已更新');
        } else {
          logger.info('仅创建不存在的表');
        }
      }
    } catch (error) {
      logger.error('SQL 数据库同步失败:', error);
    }
  }
}

async function syncMongooseDatabase() {
  if (mongoOnly || !sqlOnly) {
    try {
      logger.info('开始同步 MongoDB 数据库结构...');
      
      // 连接到 MongoDB
      if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });
        logger.info('已连接到 MongoDB');
      }
      
      // 获取所有已加载的 Mongoose 模型
      const mongooseModels = Object.values(mongoose.models);
      
      logger.info(`共发现 ${mongooseModels.length} 个 MongoDB 模型需要同步`);
      
      // 列出所有模型名称
      mongooseModels.forEach(model => {
        logger.info(`MongoDB 模型: ${model.modelName}`);
      });
      
      // 特别检查 IpBlacklist 模型
      const ipBlacklistModel = mongoose.models.IpBlacklist;
      if (ipBlacklistModel) {
        logger.info('找到 IpBlacklist 模型，正在创建索引...');
        await ipBlacklistModel.createIndexes();
        logger.info('IpBlacklist 索引创建完成');
      } else {
        logger.warn('未找到 IpBlacklist 模型，请检查模型定义');
        
        // 尝试直接加载 IpBlacklist 模型
        try {
          const IpBlacklistPath = path.join(__dirname, '../app/models/merchants/IpBlacklist.js');
          if (fs.existsSync(IpBlacklistPath)) {
            logger.info('尝试直接加载 IpBlacklist 模型...');
            const IpBlacklistModel = require(IpBlacklistPath);
            if (IpBlacklistModel) {
              logger.info('IpBlacklist 模型加载成功');
              if (typeof IpBlacklistModel.createIndexes === 'function') {
                await IpBlacklistModel.createIndexes();
                logger.info('IpBlacklist 索引创建完成');
              }
            }
          }
        } catch (error) {
          logger.error('加载 IpBlacklist 模型失败:', error);
        }
      }
      
      // 为所有模型创建索引
      for (const model of mongooseModels) {
        if (model.createIndexes) {
          await model.createIndexes();
          logger.info(`已为 ${model.modelName} 创建索引`);
        }
      }
      
      logger.info('MongoDB 数据库同步完成!');
    } catch (error) {
      logger.error('MongoDB 数据库同步失败:', error);
    }
  }
}

async function syncDatabase() {
  try {
    // 同步 SQL 数据库
    await syncSequelizeDatabase();
    
    // 同步 MongoDB 数据库
    await syncMongooseDatabase();
    
    process.exit(0);
  } catch (error) {
    logger.error('数据库同步失败:', error);
    process.exit(1);
  }
}

// 执行同步
syncDatabase();
