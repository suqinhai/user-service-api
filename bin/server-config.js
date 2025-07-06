/**
 * 服务器配置模块
 * 负责HTTP服务器的创建、配置和启动
 */

const http = require('http');
const debug = require('debug')('my-app:server');
const ServerUtils = require('./server-utils');
const GracefulShutdown = require('./graceful-shutdown');

// 简单的日志记录器，避免依赖外部模块
const clusterLogger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
  clusterEvent: (event, msg, data) => console.log(`[CLUSTER-${event}] ${msg}`, data || '')
};

class ServerConfig {
  constructor(app, options = {}) {
    this.app = app;
    this.server = null;
    this.port = null;
    this.clusterMode = options.clusterMode || false;
    this.gracefulShutdown = new GracefulShutdown();
  }

  /**
   * 初始化服务器配置
   */
  initialize() {
    // 获取并设置端口
    this.port = ServerUtils.normalizePort(process.env.PORT || '3001');
    this.app.set('port', this.port);

    // 创建HTTP服务器
    this.server = http.createServer(this.app);

    // 设置服务器事件监听器
    this.setupServerListeners();

    // 设置优雅退出处理
    this.setupGracefulShutdown();

    return this;
  }

  /**
   * 启动服务器
   */
  start() {
    if (!this.server) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    this.server.listen(this.port);
    
    if (this.clusterMode) {
      clusterLogger.info('工作进程已启动');
    } else {
      clusterLogger.info('单进程模式已启动');
    }

    return this;
  }

  /**
   * 设置服务器事件监听器
   */
  setupServerListeners() {
    this.server.on('error', (error) => this.onError(error));
    this.server.on('listening', () => this.onListening());
  }

  /**
   * 设置优雅退出处理
   */
  setupGracefulShutdown() {
    if (this.clusterMode) {
      // 集群模式下监听主进程消息
      process.on('message', (msg) => {
        if (msg === 'graceful-exit') {
          this.gracefulShutdown.handleWorkerShutdown(this.server);
        }
      });
    } else {
      // 单进程模式下监听退出信号
      process.on('SIGTERM', () => {
        this.gracefulShutdown.handleSingleProcessShutdown(this.server);
      });

      process.on('SIGINT', () => {
        this.gracefulShutdown.handleSingleProcessShutdown(this.server);
      });
    }
  }

  /**
   * 处理服务器错误事件
   */
  onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof this.port === 'string'
      ? 'Pipe ' + this.port
      : 'Port ' + this.port;

    // 处理特定的监听错误
    switch (error.code) {
      case 'EACCES':
        clusterLogger.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        clusterLogger.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  /**
   * 处理服务器监听事件
   */
  onListening() {
    const addr = this.server.address();
    const bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    
    debug('Listening on ' + bind);
    
    if (this.clusterMode) {
      clusterLogger.info(`工作进程正在监听端口 ${addr.port}`);
    } else {
      clusterLogger.info(`服务器运行在端口 ${addr.port}`);
    }
  }

  /**
   * 获取服务器实例
   */
  getServer() {
    return this.server;
  }

  /**
   * 获取端口号
   */
  getPort() {
    return this.port;
  }

  /**
   * 停止服务器
   */
  stop(callback) {
    if (this.server) {
      this.server.close(callback);
    } else if (callback) {
      callback();
    }
  }
}

module.exports = ServerConfig;
