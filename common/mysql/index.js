const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const { getEnvPath } = require('../util');
const { logger } = require('../logger');

// 加载环境变量
dotenv.config({
    path: getEnvPath()
});

// 从环境变量获取数据库配置
const config = {
    dialect: process.env.DB_DIALECT || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '123456',
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'testSxx',
    // 连接池配置 - 根据实际负载调整
    pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 20,     // 最大连接数 - 增加以支持更高并发
        min: parseInt(process.env.DB_POOL_MIN) || 5,      // 最小连接数 - 保持适量空闲连接
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000, // 获取连接超时时间(毫秒)
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000,       // 空闲连接超时时间(毫秒)
        evict: parseInt(process.env.DB_POOL_EVICT) || 1000,      // 空闲检查间隔时间(毫秒)
        maxUses: parseInt(process.env.DB_POOL_MAX_USES) || 0,    // 单个连接最大使用次数，0表示无限制
        validate: async (connection) => {
            try {
                // 验证连接是否有效
                await connection.query('SELECT 1');
                return true;
            } catch (err) {
                logger.error('数据库连接验证失败', err);
                return false;
            }
        }
    },
    // 额外配置
    define: {
        timestamps: false,  // 默认不使用 createAt 和 updateAt
        underscored: false, // 将驼峰命名转换为下划线命名
        freezeTableName: true, // 表名与模型名保持一致
        paranoid: false     // 软删除功能，设为true时会增加deletedAt字段
    },
    // 日志配置
    logging: process.env.NODE_ENV === 'dev' 
        ? (sql, timing) => logger.debug(sql, { 
            category: 'DATABASE', 
            duration: timing,
            query: sql.substr(0, 500) // 避免过长日志
          }) 
        : false,
    // 查询选项
    query: {
        raw: false,         // 默认不使用原始查询结果
        nest: false,        // 默认不嵌套结果
        plain: false,       // 默认不返回第一个结果
    },
    // 连接重试选项
    retry: {
        max: parseInt(process.env.DB_RETRY_MAX) || 3,  // 最大重试次数
        match: [            // 触发重试的错误类型
            /Deadlock/i,
            /Lock wait timeout exceeded/i
        ]
    },
    // 方言选项
    dialectOptions: {
        // 处理时区问题
        timezone: '+08:00',
        // 启用连接保持
        keepAlive: true,
        // 连接超时
        connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 60000,
        // 支持大数字
        supportBigNumbers: true,
        bigNumberStrings: true,
        // 禁用预处理语句缓存
        dateStrings: true   // 日期返回为字符串
    },
    benchmark: process.env.NODE_ENV === 'dev', // 开发环境下记录查询时间
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED // 事务隔离级别
};

// 初始化 Sequelize 实例
const sequelize = new Sequelize(config);

// 测试连接并进行健康检查
async function connection() {
    try {
        // 测试连接
        await sequelize.authenticate();
        logger.info('成功连接到 MySQL 数据库!', { category: 'DATABASE' });
    } catch (error) {
        logger.error('MySQL 连接失败:', { category: 'DATABASE', error });
        
        // 如果在开发环境中，可以尝试重连
        if (process.env.NODE_ENV === 'dev') {
            logger.info('5秒后尝试重新连接...', { category: 'DATABASE' });
            setTimeout(connection, 5000);
        }
    }
}

// 添加全局事件监听器
sequelize.addHook('beforeConnect', (config) => {
    logger.debug('正在尝试连接数据库...', { category: 'DATABASE', host: config.host });
});

sequelize.addHook('afterConnect', (connection, config) => {
    logger.debug('数据库连接成功', { category: 'DATABASE', host: config.host });
});

// 执行连接
connection();

// 导出 Sequelize 实例
module.exports = sequelize;