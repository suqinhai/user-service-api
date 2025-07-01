const Redis = require('ioredis');
const dotenv = require('dotenv');
const { getEnvPath } = require('../util');

// 加载环境变量
dotenv.config({
  path: getEnvPath()
});

// 从环境变量获取Redis配置
const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB) || 0,
  retryStrategy: function(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  // 断线自动重连
  reconnectOnError: function(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // 只有特定错误才触发重连
    }
    return false;
  },
  // 最大重连次数
  maxRetriesPerRequest: 3
};

// 创建 Redis 客户端
const redis = new Redis(config);

// 连接成功事件
// redis.on('connect', () => {
//   console.log('成功连接到 Redis 服务器');
// });

// // 连接错误事件
// redis.on('error', (err) => {
//   console.error('Redis 连接错误:', err);
// });

// // 重新连接事件
// redis.on('reconnecting', () => {
//   console.log('正在尝试重新连接到 Redis...');
// });

// 定义默认缓存时间（秒）
const TTL = {
  SHORT: parseInt(process.env.CACHE_TTL_SHORT) || 300,      // 5分钟
  MEDIUM: parseInt(process.env.CACHE_TTL_MEDIUM) || 3600,   // 1小时
  LONG: parseInt(process.env.CACHE_TTL_LONG) || 86400       // 1天
};

// 缓存键前缀，用于区分不同类型的缓存数据
const PREFIX = {
  USER: 'user:',
  CONFIG: 'config:',
  STATS: 'stats:',
  TOKEN: 'token:'
};

/**
 * 生成缓存键，带有类型前缀
 * @param {string} type - 缓存类型前缀
 * @param {string} id - 唯一标识符
 * @returns {string} 完整的缓存键名
 */
function generateKey(type, id) {
  return `${type}${id}`;
}

module.exports = {
  redis,
  TTL,
  PREFIX,
  generateKey
};


// 示例：设置和获取键值
// async function example() {
//   try {
//     // 设置键值
//     await redis.set('key', 'Hello, Redis!');
//     // 设置过期时间（秒）
//     await redis.expire('key', 60);

//     // 获取键值
//     const value = await redis.get('key');
//     console.log('Value:', value);

//     // 关闭连接
//     await redis.quit();
//   } catch (err) {
//     console.error('Error:', err);
//   }
// }

// example();