/**
 * Redis 缓存管理模块
 * 提供通用的缓存操作和管理方法
 */

const { redis, TTL, PREFIX, generateKey } = require('./index');
const logger = require('../logger');
const { LOG_CATEGORIES } = logger;

/**
 * 缓存类，提供通用的缓存操作方法
 */
class CacheManager {
  /**
   * 获取缓存数据
   * @param {string} type - 缓存类型前缀
   * @param {string} id - 唯一标识符
   * @returns {Promise<any>} 缓存的数据，若不存在则返回null
   */
  static async get(type, id) {
    const key = generateKey(type, id);
    const startTime = Date.now();
    let hit = false;

    try {
      const data = await redis.get(key);

      if (!data) {
        // 记录缓存未命中日志
        const duration = Date.now() - startTime;
        logger.logCachePerformance('GET', duration, key, false);
        return null;
      }

      hit = true;
      const result = JSON.parse(data);

      // 记录缓存命中日志
      const duration = Date.now() - startTime;
      logger.logCachePerformance('GET', duration, key, true);

      return result;
    } catch (error) {
      // 记录缓存错误日志
      const duration = Date.now() - startTime;
      logger.logError(LOG_CATEGORIES.CACHE, `缓存读取错误: ${key}`, error);
      logger.logCachePerformance('GET', duration, key, hit);

      return null; // 读取缓存失败时返回null，以便回退到数据库查询
    }
  }

  /**
   * 设置缓存数据
   * @param {string} type - 缓存类型前缀
   * @param {string} id - 唯一标识符
   * @param {any} data - 要缓存的数据
   * @param {number} ttl - 过期时间（秒），不传则使用默认的中等时长
   * @returns {Promise<boolean>} 是否成功设置缓存
   */
  static async set(type, id, data, ttl = TTL.MEDIUM) {
    const key = generateKey(type, id);
    const startTime = Date.now();

    try {
      const value = JSON.stringify(data);

      // 对象过大时进行日志记录
      if (value.length > 1024 * 100) { // 100KB
        logger.log(logger.LOG_LEVELS.WARN, LOG_CATEGORIES.CACHE, `大对象缓存警告: ${key} 大小为 ${Math.round(value.length / 1024)}KB`);
      }

      // 使用 set 命令并设置过期时间
      await redis.set(key, value, 'EX', ttl);

      // 记录缓存设置日志
      const duration = Date.now() - startTime;
      logger.logCachePerformance('SET', duration, key);

      return true;
    } catch (error) {
      // 记录缓存错误日志
      const duration = Date.now() - startTime;
      logger.logError(LOG_CATEGORIES.CACHE, `缓存写入错误: ${key}`, error);
      logger.logCachePerformance('SET', duration, key);

      return false; // 设置缓存失败时返回false
    }
  }

  /**
   * 删除缓存
   * @param {string} type - 缓存类型前缀
   * @param {string} id - 唯一标识符
   * @returns {Promise<boolean>} 是否成功删除缓存
   */
  static async del(type, id) {
    const key = generateKey(type, id);
    const startTime = Date.now();

    try {
      await redis.del(key);

      // 记录缓存删除日志
      const duration = Date.now() - startTime;
      logger.logCachePerformance('DEL', duration, key);

      return true;
    } catch (error) {
      // 记录缓存错误日志
      const duration = Date.now() - startTime;
      logger.logError(LOG_CATEGORIES.CACHE, `缓存删除错误: ${key}`, error);
      logger.logCachePerformance('DEL', duration, key);

      return false;
    }
  }

  /**
   * 清除特定类型的所有缓存
   * @param {string} type - 缓存类型前缀
   * @returns {Promise<boolean>} 是否成功清除缓存
   */
  static async clearByType(type) {
    const startTime = Date.now();

    try {
      // 使用 keys 命令查找特定前缀的所有键
      const keys = await redis.keys(`${type}*`);

      if (keys.length === 0) {
        // 记录缓存清除日志
        const duration = Date.now() - startTime;
        logger.logCachePerformance('CLEAR', duration, type);
        return true;
      }

      // 使用 del 命令删除所有找到的键
      await redis.del(keys);

      // 记录缓存清除日志
      const duration = Date.now() - startTime;
      logger.log(logger.LOG_LEVELS.INFO, LOG_CATEGORIES.CACHE, `清除缓存类型: ${type}, 删除了 ${keys.length} 个键`);
      logger.logCachePerformance('CLEAR', duration, type);

      return true;
    } catch (error) {
      // 记录缓存错误日志
      const duration = Date.now() - startTime;
      logger.logError(LOG_CATEGORIES.CACHE, `缓存清除错误: ${type}`, error);
      logger.logCachePerformance('CLEAR', duration, type);

      return false;
    }
  }

  /**
   * 缓存包装器 - 先尝试从缓存获取，不存在则从数据库查询并缓存结果
   * @param {string} type - 缓存类型前缀
   * @param {string} id - 唯一标识符
   * @param {Function} fetchFunction - 获取数据的函数，返回Promise
   * @param {number} ttl - 缓存有效期（秒）
   * @returns {Promise<any>} 获取的数据
   */
  static async getOrFetch(type, id, fetchFunction, ttl = TTL.MEDIUM) {
    const key = generateKey(type, id);
    const startTime = Date.now();
    let hit = false;

    try {
      // 尝试从缓存获取
      const cachedData = await this.get(type, id);

      // 如果缓存中存在数据，直接返回
      if (cachedData !== null) {
        hit = true;
        return cachedData;
      }

      // 记录缓存未命中
      logger.log(logger.LOG_LEVELS.DEBUG, LOG_CATEGORIES.CACHE, `缓存未命中: ${key}`);

      // 记录数据源获取开始时间
      const fetchStartTime = Date.now();

      // 否则从数据源获取数据
      const freshData = await fetchFunction();

      // 记录数据源获取时间
      const fetchDuration = Date.now() - fetchStartTime;
      logger.logDatabasePerformance('查询', fetchDuration, `缓存回退查询: ${key}`);

      // 缓存获取的数据（如果不为null或undefined）
      if (freshData != null) {
        await this.set(type, id, freshData, ttl);
      }

      // 记录整体处理时间
      const totalDuration = Date.now() - startTime;
      logger.log(logger.LOG_LEVELS.DEBUG, LOG_CATEGORIES.CACHE, `缓存包装器处理: ${key}, 耗时: ${totalDuration}ms, 命中: ${hit}`);

      return freshData;
    } catch (error) {
      // 记录错误日志
      const duration = Date.now() - startTime;
      logger.logError(LOG_CATEGORIES.CACHE, `缓存获取/查询错误: ${key}`, error);
      logger.logCachePerformance('GET_OR_FETCH', duration, key, hit);

      // 发生错误时，尝试直接从数据源获取
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.logError(LOG_CATEGORIES.CACHE, `数据源查询失败: ${key}`, fetchError);
        throw fetchError; // 重新抛出错误，由调用者处理
      }
    }
  }

  /**
   * 批量获取或查询并缓存多个项
   * @param {string} type - 缓存类型前缀
   * @param {Array<string>} ids - 唯一标识符数组
   * @param {Function} batchFetchFunction - 批量获取数据的函数，接收未命中缓存的id数组
   * @param {number} ttl - 缓存有效期（秒）
   * @returns {Promise<Object>} 获取的数据，键为id
   */
  static async batchGetOrFetch(type, ids, batchFetchFunction, ttl = TTL.MEDIUM) {
    if (!ids || ids.length === 0) return {};

    const startTime = Date.now();

    // 创建结果对象
    const result = {};
    const missedIds = [];

    try {
      // 生成所有缓存键
      const keys = ids.map(id => generateKey(type, id));

      // 批量获取缓存
      const cachedValues = await redis.mget(keys);

      // 记录缓存命中率
      const hitCount = cachedValues.filter(val => val !== null && val !== undefined).length;
      const hitRate = (hitCount / ids.length) * 100;
      logger.log(
        logger.LOG_LEVELS.DEBUG,
        LOG_CATEGORIES.CACHE,
        `批量缓存命中率: ${hitRate.toFixed(2)}% (${hitCount}/${ids.length})`,
        { type, idsCount: ids.length }
      );

      // 处理缓存命中的情况
      ids.forEach((id, index) => {
        if (cachedValues[index]) {
          try {
            result[id] = JSON.parse(cachedValues[index]);
          } catch (e) {
            // 解析失败，添加到未命中列表
            missedIds.push(id);
          }
        } else {
          // 缓存未命中，添加到未命中列表
          missedIds.push(id);
        }
      });

      // 如果有未命中的id，从数据源批量获取
      if (missedIds.length > 0) {
        // 记录数据源获取开始时间
        const fetchStartTime = Date.now();

        const fetchedData = await batchFetchFunction(missedIds);

        // 记录数据源获取时间
        const fetchDuration = Date.now() - fetchStartTime;
        logger.logDatabasePerformance('批量查询', fetchDuration, `缓存回退批量查询: ${type}`, { missedCount: missedIds.length });

        // 将获取的数据添加到结果并缓存
        for (const id in fetchedData) {
          result[id] = fetchedData[id];

          // 异步缓存，不等待完成
          this.set(type, id, fetchedData[id], ttl)
            .catch(err => logger.logError(LOG_CATEGORIES.CACHE, `缓存项 ${type}${id} 失败`, err));
        }
      }

      // 记录整体处理时间
      const totalDuration = Date.now() - startTime;
      logger.log(
        logger.LOG_LEVELS.DEBUG,
        LOG_CATEGORIES.CACHE,
        `批量缓存处理完成, 耗时: ${totalDuration}ms, 总数: ${ids.length}, 未命中: ${missedIds.length}`
      );

      return result;
    } catch (error) {
      // 记录错误日志
      const duration = Date.now() - startTime;
      logger.logError(LOG_CATEGORIES.CACHE, `批量缓存处理错误: ${type}`, error);
      logger.logCachePerformance('BATCH_GET_OR_FETCH', duration, type);

      // 发生错误时，尝试直接从数据源批量获取所有id
      try {
        return await batchFetchFunction(ids);
      } catch (fetchError) {
        logger.logError(LOG_CATEGORIES.CACHE, `数据源批量获取失败: ${type}`, fetchError);
        return result; // 返回已获取的部分结果
      }
    }
  }

  /**
   * 按模式清除缓存
   * @param {string} type - 缓存类型前缀
   * @param {string|RegExp} pattern - 匹配模式，可以是字符串或正则表达式
   * @returns {Promise<Array<string>>} 已删除的键数组
   */
  static async clearByPattern(type, pattern) {
    const startTime = Date.now();
    let keys = [];

    try {
      // 获取所有以type开头的键
      const allKeys = await redis.keys(`${type}*`);
      
      // 没有键时直接返回
      if (allKeys.length === 0) {
        const duration = Date.now() - startTime;
        logger.logCachePerformance('CLEAR_PATTERN', duration, `${type}:${pattern}`);
        return [];
      }

      // 根据模式过滤键
      if (pattern instanceof RegExp) {
        // 使用正则表达式过滤
        keys = allKeys.filter(key => pattern.test(key));
      } else if (typeof pattern === 'string') {
        // 使用字符串包含过滤
        keys = allKeys.filter(key => key.includes(pattern));
      } else {
        // 如果模式不是字符串也不是正则表达式，使用所有键
        keys = allKeys;
      }

      // 如果没有匹配的键，直接返回
      if (keys.length === 0) {
        const duration = Date.now() - startTime;
        logger.logCachePerformance('CLEAR_PATTERN', duration, `${type}:${pattern}`);
        return [];
      }

      // 删除匹配的键
      await redis.del(keys);

      // 记录缓存清除日志
      const duration = Date.now() - startTime;
      logger.log(
        logger.LOG_LEVELS.INFO, 
        LOG_CATEGORIES.CACHE, 
        `按模式清除缓存: ${type}:${pattern}, 删除了 ${keys.length} 个键`,
        { matchedKeys: keys.length, totalKeys: allKeys.length }
      );
      logger.logCachePerformance('CLEAR_PATTERN', duration, `${type}:${pattern}`);

      return keys;
    } catch (error) {
      // 记录缓存错误日志
      const duration = Date.now() - startTime;
      logger.logError(
        LOG_CATEGORIES.CACHE, 
        `按模式清除缓存错误: ${type}:${pattern}`, 
        error
      );
      logger.logCachePerformance('CLEAR_PATTERN', duration, `${type}:${pattern}`);

      return [];
    }
  }
}

module.exports = CacheManager; 