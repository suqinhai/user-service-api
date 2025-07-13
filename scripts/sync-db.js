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
const skipMongo = process.env.SKIP_MONGO_SYNC === 'true' || args.includes('--skip-mongo');

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

        // 先同步用户数据库模型，因为它们可能被主数据库模型引用
        if (sequelizeUserModels.length > 0) {
          logger.info('开始同步用户数据库模型...');
          await sequelizeUser.sync(syncOptions);
          logger.info('用户数据库同步完成!');
        }
        
        // 然后同步主数据库模型
        if (sequelizeModels.length > 0) {
          logger.info('开始同步主数据库模型...');
          
          // 如果有外键约束问题，可以先禁用外键检查
          if (force || alter) {
            logger.info('临时禁用外键约束检查...');
            await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
          }
          
          try {
            await sequelize.sync(syncOptions);
            logger.info('主数据库同步完成!');
          } finally {
            // 恢复外键检查
            if (force || alter) {
              logger.info('恢复外键约束检查...');
              await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
            }
          }
        }
        
        // 单独同步 IpBlacklist 模型，确保它在用户表之后创建
        try {
          if (models.IpBlacklistModel) {
            logger.info('同步 IpBlacklist 表结构...');
            await models.IpBlacklistModel.sync(syncOptions);
            logger.info('IpBlacklist 表结构同步完成');
          }
        } catch (error) {
          logger.error('同步 IpBlacklist 表结构失败:', error);
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
      
      // 从环境变量获取MongoDB连接URI
      const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
      
      // 检查是否配置了MongoDB URI
      if (!mongoUri) {
        logger.warn('未配置MongoDB连接URI，跳过MongoDB同步');
        return;
      }
      
      // 连接到 MongoDB
      if (!mongoose.connection.readyState) {
        logger.info(`尝试连接到MongoDB: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
        
        await mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000 // 设置较短的超时时间，避免长时间等待
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
      
      // 为所有模型创建索引
      for (const model of mongooseModels) {
        if (model.createIndexes) {
          await model.createIndexes();
          logger.info(`已为 ${model.modelName} 创建索引`);
        }
      }
      
      logger.info('MongoDB 数据库同步完成!');
    } catch (error) {
      // 详细记录错误信息
      logger.error('MongoDB 数据库同步失败:', {
        message: error.message,
        stack: error.stack,
        reason: error.reason ? error.reason.message : '未知原因'
      });
      
      // 如果是连接错误，提供更多诊断信息
      if (error.name === 'MongooseError' || error.name === 'MongoError') {
        logger.error('MongoDB连接问题，请检查：');
        logger.error('1. MongoDB服务是否运行');
        logger.error('2. 连接URI是否正确');
        logger.error('3. 网络连接是否正常');
        logger.error('4. 认证信息是否正确');
      }
    } finally {
      // 如果连接已建立，尝试断开连接
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
          logger.info('MongoDB连接已断开');
        } catch (err) {
          logger.error('断开MongoDB连接时出错:', err.message);
        }
      }
    }
  }
}

async function syncDatabase() {
  let sqlSuccess = true;
  let mongoSuccess = true;
  
  try {
    // 同步 SQL 数据库
    if (!mongoOnly) {
      try {
        await syncSequelizeDatabase();
        logger.info('SQL 数据库同步成功');
      } catch (error) {
        sqlSuccess = false;
        logger.error('SQL 数据库同步失败:', error);
      }
    }
    
    // 同步 MongoDB 数据库，除非明确跳过
    if (!sqlOnly && !skipMongo) {
      try {
        await syncMongooseDatabase();
        logger.info('MongoDB 数据库同步成功');
      } catch (error) {
        mongoSuccess = false;
        logger.error('MongoDB 数据库同步失败:', error);
        logger.warn('MongoDB 同步失败，但将继续处理 SQL 数据库');
      }
    } else if (skipMongo) {
      logger.info('已跳过 MongoDB 同步');
      mongoSuccess = true; // 标记为成功，因为已明确跳过
    }
    
    // 根据同步结果设置退出码
    if ((mongoOnly && !mongoSuccess) || (sqlOnly && !sqlSuccess) || (!mongoOnly && !sqlOnly && !sqlSuccess && (!mongoSuccess && !skipMongo))) {
      logger.error('数据库同步过程中发生错误');
      process.exit(1);
    } else {
      logger.info('数据库同步完成');
      process.exit(0);
    }
  } catch (error) {
    logger.error('数据库同步过程中发生未处理的错误:', error);
    process.exit(1);
  }
}

// 执行同步
syncDatabase();
