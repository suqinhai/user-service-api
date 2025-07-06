/**
 * 优雅退出处理模块
 * 负责处理应用程序的优雅退出逻辑
 */

// 简单的日志记录器，避免依赖外部模块
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
  clusterEvent: (event, msg, data) => console.log(`[CLUSTER-${event}] ${msg}`, data || '')
};

class GracefulShutdown {
  constructor(options = {}) {
    this.shutdownTimeout = options.shutdownTimeout || 3000;
    this.isShuttingDown = false;
  }

  /**
   * 处理工作进程的优雅退出
   * @param {http.Server} server - HTTP服务器实例
   */
  handleWorkerShutdown(server) {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.clusterEvent('SHUTDOWN', '工作进程准备优雅退出...');

    this.performGracefulShutdown(server, () => {
      logger.info('所有连接已关闭，工作进程退出中...');
      process.exit(0);
    }, () => {
      logger.warn('强制退出工作进程');
      process.exit(1);
    });
  }

  /**
   * 处理单进程模式的优雅退出
   * @param {http.Server} server - HTTP服务器实例
   */
  handleSingleProcessShutdown(server) {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.clusterEvent('SHUTDOWN', '单进程模式接收到退出信号，准备优雅退出...');

    this.performGracefulShutdown(server, () => {
      logger.info('服务器已关闭，进程退出中...');
      process.exit(0);
    }, () => {
      logger.warn('强制退出');
      process.exit(1);
    });
  }

  /**
   * 执行优雅退出流程
   * @param {http.Server} server - HTTP服务器实例
   * @param {Function} onSuccess - 成功回调
   * @param {Function} onTimeout - 超时回调
   */
  performGracefulShutdown(server, onSuccess, onTimeout) {
    // 停止接受新的连接
    server.close((err) => {
      if (err) {
        logger.error('关闭服务器时发生错误:', err);
      }

      if (onSuccess) {
        onSuccess();
      }
    });
    
    // 设置超时强制退出
    setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
    }, this.shutdownTimeout);
  }

  /**
   * 处理未捕获的异常
   */
  handleUncaughtException() {
    process.on('uncaughtException', (err) => {
      logger.error('未捕获的异常:', err);
      this.forceExit(1);
    });
  }

  /**
   * 处理未处理的Promise拒绝
   */
  handleUnhandledRejection() {
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝:', reason);
      logger.error('Promise:', promise);
      this.forceExit(1);
    });
  }

  /**
   * 强制退出进程
   * @param {number} code - 退出代码
   */
  forceExit(code = 0) {
    setTimeout(() => {
      process.exit(code);
    }, 100);
  }

  /**
   * 设置退出超时时间
   * @param {number} timeout - 超时时间（毫秒）
   */
  setShutdownTimeout(timeout) {
    this.shutdownTimeout = timeout;
  }

  /**
   * 获取退出超时时间
   * @returns {number} 超时时间（毫秒）
   */
  getShutdownTimeout() {
    return this.shutdownTimeout;
  }

  /**
   * 检查是否正在关闭
   * @returns {boolean} 是否正在关闭
   */
  isShuttingDownProcess() {
    return this.isShuttingDown;
  }

  /**
   * 初始化全局异常处理
   */
  initializeGlobalHandlers() {
    this.handleUncaughtException();
    this.handleUnhandledRejection();
  }

  /**
   * 清理资源
   * @param {Function} callback - 清理完成回调
   */
  cleanup(callback) {
    // 这里可以添加清理逻辑，比如关闭数据库连接、清理临时文件等
    logger.info('正在清理资源...');

    // 模拟异步清理操作
    setTimeout(() => {
      logger.info('资源清理完成');
      if (callback) {
        callback();
      }
    }, 100);
  }
}

module.exports = GracefulShutdown;
