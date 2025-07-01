/**
 * 总台登录失败跟踪服务
 * 处理总台登录失败次数记录和锁定逻辑
 */

const BaseService = require('../base/BaseService');
const CacheManager = require('../../common/redis/cache');
const { logger } = require('../../common/logger');

class ConsoleLoginTracker extends BaseService {
  constructor() {
    super();
    this.maxFailedAttempts = 10; // 最大失败次数
    this.lockPrefix = 'console_login_locked'; // 锁定状态缓存前缀
    this.failCountPrefix = 'console_login_fails'; // 失败次数缓存前缀
  }

  /**
   * 检查账号是否被锁定
   * @param {string} username - 用户名
   * @returns {Promise<Object>} 锁定状态信息
   */
  async checkLockStatus(username) {
    try {
      const lockKey = `${this.lockPrefix}:${username}`;
      const lockInfo = await CacheManager.get(this.lockPrefix, lockKey);
      
      if (lockInfo) {
        const now = new Date();
        const lockUntil = new Date(lockInfo.lockUntil);
        
        // 检查锁定是否已过期
        if (now >= lockUntil) {
          // 锁定已过期，清除锁定状态和失败计数
          await this.clearLockAndFailCount(username);
          return {
            isLocked: false,
            message: '账号锁定已解除'
          };
        }
        
        return {
          isLocked: true,
          lockUntil: lockInfo.lockUntil,
          message: `账号已被锁定，请明天再试。解锁时间：${lockInfo.lockUntil}`
        };
      }
      
      return {
        isLocked: false,
        message: '账号未被锁定'
      };
    } catch (error) {
      this.logError('检查总台账号锁定状态失败', error);
      // 出错时为了安全起见，不阻止登录
      return {
        isLocked: false,
        message: '锁定状态检查异常'
      };
    }
  }

  /**
   * 记录登录失败
   * @param {string} username - 用户名
   * @param {string} ip - 客户端IP
   * @returns {Promise<Object>} 处理结果
   */
  async recordFailedAttempt(username, ip) {
    try {
      const failKey = `${this.failCountPrefix}:${username}`;
      
      // 获取当前失败次数
      let failCount = await CacheManager.get(this.failCountPrefix, failKey) || 0;
      failCount++;
      
      // 记录失败次数，设置过期时间为明天凌晨
      const tomorrow = this.getTomorrowMidnight();
      const ttlSeconds = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
      
      await CacheManager.set(this.failCountPrefix, failKey, failCount, ttlSeconds);
      
      // 记录日志
      this.logAction(`总台登录失败记录: ${username}, 第${failCount}次失败, IP: ${ip}`);
      
      // 检查是否达到锁定条件
      if (failCount >= this.maxFailedAttempts) {
        await this.lockAccount(username, tomorrow);
        
        return {
          shouldLock: true,
          failCount,
          message: `登录失败次数已达${this.maxFailedAttempts}次，账号已被锁定到明天`,
          lockUntil: tomorrow.toISOString()
        };
      }
      
      return {
        shouldLock: false,
        failCount,
        remainingAttempts: this.maxFailedAttempts - failCount,
        message: `登录失败，还有${this.maxFailedAttempts - failCount}次尝试机会`
      };
      
    } catch (error) {
      this.logError('记录总台登录失败失败', error);
      throw error;
    }
  }

  /**
   * 记录登录成功，清除失败计数
   * @param {string} username - 用户名
   * @param {string} ip - 客户端IP
   */
  async recordSuccessfulLogin(username, ip) {
    try {
      await this.clearLockAndFailCount(username);
      // this.logAction(`总台登录成功: ${username}, IP: ${ip}`);
    } catch (error) {
      this.logError('清除总台登录失败计数失败', error);
      // 登录成功时清除失败不应该影响登录流程
    }
  }

  /**
   * 锁定账号
   * @param {string} username - 用户名
   * @param {Date} lockUntil - 锁定到什么时候
   */
  async lockAccount(username, lockUntil) {
    try {
      const lockKey = `${this.lockPrefix}:${username}`;
      const lockInfo = {
        username,
        lockUntil: lockUntil.toISOString(),
        lockedAt: new Date().toISOString()
      };
      
      const ttlSeconds = Math.floor((lockUntil.getTime() - Date.now()) / 1000);
      await CacheManager.set(this.lockPrefix, lockKey, lockInfo, ttlSeconds);
      
      // 记录安全日志
      logger.security('总台账号被锁定', {
        username,
        lockUntil: lockInfo.lockUntil,
        reason: '登录失败次数超限'
      });
      
    } catch (error) {
      this.logError('锁定总台账号失败', error);
      throw error;
    }
  }

  /**
   * 清除锁定状态和失败计数
   * @param {string} username - 用户名
   */
  async clearLockAndFailCount(username) {
    try {
      const lockKey = `${this.lockPrefix}:${username}`;
      const failKey = `${this.failCountPrefix}:${username}`;
      
      await Promise.all([
        CacheManager.del(this.lockPrefix, lockKey),
        CacheManager.del(this.failCountPrefix, failKey)
      ]);
      
    } catch (error) {
      this.logError('清除总台登录状态失败', error);
      throw error;
    }
  }

  /**
   * 获取明天凌晨的时间
   * @returns {Date} 明天凌晨0点的时间
   */
  getTomorrowMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * 获取账号的失败次数
   * @param {string} username - 用户名
   * @returns {Promise<number>} 失败次数
   */
  async getFailedAttempts(username) {
    try {
      const failKey = `${this.failCountPrefix}:${username}`;
      return await CacheManager.get(this.failCountPrefix, failKey) || 0;
    } catch (error) {
      this.logError('获取总台登录失败次数失败', error);
      return 0;
    }
  }
}

module.exports = ConsoleLoginTracker;
