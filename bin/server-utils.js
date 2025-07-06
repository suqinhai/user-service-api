/**
 * 服务器工具函数模块
 * 提供服务器相关的通用工具函数
 */

class ServerUtils {
  /**
   * 标准化端口号
   * 将端口值转换为数字、字符串或false
   * @param {string|number} val - 端口值
   * @returns {number|string|boolean} 标准化后的端口值
   */
  static normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
      // 命名管道
      return val;
    }

    if (port >= 0) {
      // 端口号
      return port;
    }

    return false;
  }

  /**
   * 检查是否启用集群模式
   * @returns {boolean} 是否启用集群模式
   */
  static isClusterModeEnabled() {
    return process.env.CLUSTER_MODE === 'true';
  }

  /**
   * 获取环境变量值
   * @param {string} key - 环境变量键名
   * @param {string} defaultValue - 默认值
   * @returns {string} 环境变量值或默认值
   */
  static getEnvVar(key, defaultValue = '') {
    return process.env[key] || defaultValue;
  }

  /**
   * 验证端口号是否有效
   * @param {number} port - 端口号
   * @returns {boolean} 端口号是否有效
   */
  static isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * 格式化绑定地址信息
   * @param {string|number} port - 端口或管道
   * @returns {string} 格式化后的绑定信息
   */
  static formatBindInfo(port) {
    return typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
  }

  /**
   * 格式化服务器地址信息
   * @param {object} addr - 服务器地址对象
   * @returns {string} 格式化后的地址信息
   */
  static formatServerAddress(addr) {
    return typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  }

  /**
   * 获取错误消息
   * @param {string} code - 错误代码
   * @param {string|number} port - 端口信息
   * @returns {string} 错误消息
   */
  static getErrorMessage(code, port) {
    const bind = this.formatBindInfo(port);
    
    switch (code) {
      case 'EACCES':
        return bind + ' requires elevated privileges';
      case 'EADDRINUSE':
        return bind + ' is already in use';
      default:
        return `Unknown error: ${code}`;
    }
  }

  /**
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} Promise对象
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 安全地解析JSON
   * @param {string} jsonString - JSON字符串
   * @param {*} defaultValue - 解析失败时的默认值
   * @returns {*} 解析结果或默认值
   */
  static safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * 检查对象是否为空
   * @param {object} obj - 要检查的对象
   * @returns {boolean} 对象是否为空
   */
  static isEmpty(obj) {
    return obj == null || Object.keys(obj).length === 0;
  }

  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = ServerUtils;
