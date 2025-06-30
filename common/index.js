/**
 * 公共模块统一导出文件
 * 功能：集中管理和导出所有公共功能模块，便于在应用中统一引用
 * 架构：包含数据库连接、缓存管理、工具函数、国际化、日志等核心功能
 */

// 引入MySQL数据库连接模块（Sequelize ORM）
const sequelize = require('./mysql');
// 引入MongoDB数据库连接模块
const mongodb = require('./mango');
// 引入路由处理器模块，提供统一的响应格式
const routeHandler = require('./routeHandler');
// 引入Redis连接模块
const redis = require('./redis');
// 引入缓存管理器模块，基于Redis实现
const cacheManager = require('./redis/cache');
// 引入工具函数模块，提供各种辅助功能
const util = require('./util');
// 引入定时任务调度模块
const schedule = require('./schedule');
// 引入国际化模块，支持多语言
const i18n = require('./i18n');
// 引入日志模块，提供结构化日志记录
const logger = require('./logger');

// 导出所有公共模块，使用展开运算符合并对象
module.exports = {
    // 展开工具函数模块的所有导出
    ...util,
    // 展开路由处理器模块的所有导出（响应格式化函数）
    ...routeHandler,
    // 数据库连接实例
    sequelize,      // MySQL/PostgreSQL数据库连接
    mongodb,        // MongoDB数据库连接
    redis,          // Redis缓存数据库连接
    cacheManager,   // 缓存管理器实例
    schedule,       // 定时任务调度器
    // 展开国际化模块的所有导出
    ...i18n,
    // 展开日志模块的所有导出
    ...logger
};



