/**
 * 集群管理模块
 * 负责处理集群模式下的主进程逻辑，包括工作进程的创建、监控和管理
 */

const cluster = require('cluster');
const os = require('os');

// 简单的日志记录器，避免依赖外部模块
const clusterLogger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
  clusterEvent: (event, msg, data) => console.log(`[CLUSTER-${event}] ${msg}`, data || '')
};

class ClusterManager {
  constructor() {
    this.numCPUs = os.cpus().length;
    this.workerCount = 0;
    this.isShuttingDown = false;
  }

  /**
   * 启动集群模式
   */
  start() {
    if (!cluster.isMaster) {
      throw new Error('ClusterManager should only be used in master process');
    }

    clusterLogger.info(`主进程已启动`);
    clusterLogger.info(`启动 ${this.numCPUs} 个工作进程...`);

    // 创建工作进程
    this.createWorkers();
    
    // 设置事件监听器
    this.setupEventListeners();
    
    // 设置优雅退出处理
    this.setupGracefulShutdown();
  }

  /**
   * 创建工作进程
   */
  createWorkers() {
    for (let i = 0; i < this.numCPUs; i++) {
      this.forkWorker();
    }
  }

  /**
   * 创建单个工作进程
   */
  forkWorker() {
    cluster.fork();
    this.workerCount++;
  }

  /**
   * 设置集群事件监听器
   */
  setupEventListeners() {
    // 监听工作进程退出事件
    cluster.on('exit', (worker, code, signal) => {
      clusterLogger.clusterEvent('EXIT', `工作进程已退出`, { 
        workerId: worker.id,
        pid: worker.process.pid,
        exitCode: code,
        signal: signal || 'none'
      });
      
      this.workerCount--;
      
      // 如果不是正常退出且不在关闭过程中，则重新创建工作进程
      if (code !== 0 && !worker.exitedAfterDisconnect && !this.isShuttingDown) {
        clusterLogger.info('正在创建新的工作进程...');
        this.forkWorker();
      }

      clusterLogger.info(`当前活动工作进程数量: ${this.workerCount}`);
    });

    // 监听工作进程在线事件
    cluster.on('online', (worker) => {
      clusterLogger.clusterEvent('ONLINE', '工作进程已上线', {
        workerId: worker.id,
        pid: worker.process.pid
      });
    });
  }

  /**
   * 设置优雅退出处理
   */
  setupGracefulShutdown() {
    process.on('SIGTERM', () => {
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      this.gracefulShutdown();
    });
  }

  /**
   * 优雅退出处理
   */
  gracefulShutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    clusterLogger.clusterEvent('SHUTDOWN', '主进程接收到退出信号，准备优雅退出...');
    
    // 通知所有工作进程进行优雅退出
    for (const id in cluster.workers) {
      if (cluster.workers[id]) {
        cluster.workers[id].send('graceful-exit');
      }
    }
    
    // 设置超时强制退出
    const exitTimeout = setTimeout(() => {
      clusterLogger.warn('超时强制退出...');
      process.exit(0);
    }, 5000);
    
    // 等待所有工作进程退出
    const exitInterval = setInterval(() => {
      if (this.workerCount === 0) {
        clusterLogger.info('所有工作进程已退出，主进程退出中...');
        clearInterval(exitInterval);
        clearTimeout(exitTimeout);
        process.exit(0);
      }
    }, 100);
  }

  /**
   * 获取当前工作进程数量
   */
  getWorkerCount() {
    return this.workerCount;
  }

  /**
   * 检查是否为主进程
   */
  static isMaster() {
    return cluster.isMaster;
  }
}

module.exports = ClusterManager;
