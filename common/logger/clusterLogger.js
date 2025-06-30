const cluster = require('cluster');
const winston = require('winston');
const { format, createLogger, transports } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * 集群日志记录类
 */
class ClusterLogger {
    /**
     * 创建一个新的集群日志记录实例
     */
    constructor() {
        this.isMaster = cluster.isMaster;
        this.pid = process.pid;
        this.processType = this.isMaster ? '主进程' : '工作进程';
        
        // 创建自定义日志格式
        const customFormat = format.combine(
            format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss.SSS'
            }),
            format.printf(info => {
                const { timestamp, level, message, ...rest } = info;
                let logMessage = `[${timestamp}] [${this.processType} ${this.pid}] [${level.toUpperCase()}] ${message}`;
                
                if (Object.keys(rest).length > 0 && rest.data) {
                    try {
                        const dataString = typeof rest.data === 'string' 
                            ? rest.data 
                            : JSON.stringify(rest.data, null, 2);
                        logMessage += `\n${dataString}`;
                    } catch (error) {
                        logMessage += '\n[无法序列化的数据]';
                    }
                }
                
                return logMessage;
            })
        );
        
        // 创建Winston日志记录器实例
        this.logger = createLogger({
            format: customFormat,
            transports: [
                new transports.Console({
                    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
                }),
                new DailyRotateFile({
                    filename: path.join(logDir, '%DATE%-cluster.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'info',
                    maxSize: '20m',
                    maxFiles: '14d',
                    format: format.combine(
                        format.uncolorize()
                    )
                }),
                new DailyRotateFile({
                    filename: path.join(logDir, '%DATE%-cluster-error.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'error',
                    maxSize: '20m',
                    maxFiles: '30d',
                    format: format.combine(
                        format.uncolorize()
                    )
                })
            ],
            exitOnError: false
        });
    }

    /**
     * 记录普通消息
     * @param {string} message - 要记录的消息
     * @param {Object} [data] - 附加数据
     */
    log(message, data = null) {
        this.logger.info(message, data ? { data } : undefined);
    }

    /**
     * 记录信息消息
     * @param {string} message - 要记录的消息
     * @param {Object} [data] - 附加数据
     */
    info(message, data = null) {
        this.logger.info(message, data ? { data } : undefined);
    }

    /**
     * 记录警告消息
     * @param {string} message - 要记录的消息
     * @param {Object} [data] - 附加数据
     */
    warn(message, data = null) {
        this.logger.warn(message, data ? { data } : undefined);
    }

    /**
     * 记录错误消息
     * @param {string} message - 要记录的消息
     * @param {Error|Object} [error] - 相关的错误对象或附加数据
     */
    error(message, error = null) {
        if (error instanceof Error) {
            this.logger.error(message, { 
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
        } else if (error) {
            this.logger.error(message, { data: error });
        } else {
            this.logger.error(message);
        }
    }
    
    /**
     * 记录集群事件
     * @param {string} eventType - 事件类型
     * @param {string} message - 事件消息
     * @param {Object} [data] - 附加数据
     */
    clusterEvent(eventType, message, data = null) {
        const formattedMessage = `[CLUSTER:${eventType}] ${message}`;
        this.logger.info(formattedMessage, data ? { data } : undefined);
    }
    
    /**
     * 记录调试信息（仅在开发环境显示）
     * @param {string} message - 要记录的消息 
     * @param {Object} [data] - 附加数据
     */
    debug(message, data = null) {
        this.logger.debug(message, data ? { data } : undefined);
    }
    
    /**
     * 记录严重错误（可能导致应用崩溃的错误）
     * @param {string} message - 要记录的消息
     * @param {Error} [error] - 错误对象
     */
    fatal(message, error = null) {
        const formattedMessage = `[FATAL] ${message}`;
        if (error instanceof Error) {
            this.logger.error(formattedMessage, { 
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
        } else {
            this.logger.error(formattedMessage);
        }
    }
}

module.exports = new ClusterLogger(); 