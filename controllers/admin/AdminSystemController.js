/**
 * 管理员系统控制器
 * 处理管理端系统管理相关的HTTP请求
 */

const BaseController = require('../base/BaseController');
const AdminSystemService = require('../../services/admin/AdminSystemService');

class AdminSystemController extends BaseController {
  constructor() {
    super();
    this.adminSystemService = new AdminSystemService();
  }

  /**
   * 获取系统信息
   * GET /api/admin/system/info
   */
  getSystemInfo = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取系统信息请求', req);

      // 调用服务层获取系统信息
      const systemInfo = await this.adminSystemService.getSystemInfo();

      return this.sendSuccess(res, '获取系统信息成功', {
        system: systemInfo
      });

    } catch (error) {
      this.logError('获取系统信息失败', error, req);
      return this.sendError(res, '获取系统信息失败', 500);
    }
  });

  /**
   * 获取应用健康状态
   * GET /api/admin/system/health
   */
  getHealthStatus = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取应用健康状态请求', req);

      // 调用服务层获取健康状态
      const healthStatus = await this.adminSystemService.getHealthStatus(
        res.sequelize,
        res.mongodb
      );

      // 根据健康状态设置HTTP状态码
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

      return res.status(statusCode).json({
        success: healthStatus.status === 'healthy',
        message: healthStatus.status === 'healthy' ? '系统健康' : '系统异常',
        data: healthStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logError('获取应用健康状态失败', error, req);
      return this.sendError(res, '获取应用健康状态失败', 500);
    }
  });

  /**
   * 清除系统缓存
   * POST /api/admin/system/cache/clear
   */
  clearSystemCache = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('清除系统缓存请求', req);

      const { cacheTypes } = req.body;

      // 验证缓存类型
      if (cacheTypes && !Array.isArray(cacheTypes)) {
        return this.sendError(res, '缓存类型必须是数组格式', 400);
      }

      // 调用服务层清除缓存
      const results = await this.adminSystemService.clearSystemCache(cacheTypes);

      return this.sendSuccess(res, '系统缓存清除完成', {
        results
      });

    } catch (error) {
      this.logError('清除系统缓存失败', error, req);
      return this.sendError(res, '清除系统缓存失败', 500);
    }
  });

  /**
   * 获取系统日志
   * GET /api/admin/system/logs
   */
  getSystemLogs = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取系统日志请求', req);

      // 获取查询参数
      const options = {
        level: req.query.level,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      // 验证参数
      if (options.limit > 1000) {
        return this.sendError(res, '单次查询日志数量不能超过1000条', 400);
      }

      // 调用服务层获取日志
      const result = await this.adminSystemService.getSystemLogs(options);

      return this.sendSuccess(res, '获取系统日志成功', result);

    } catch (error) {
      this.logError('获取系统日志失败', error, req);
      return this.sendError(res, '获取系统日志失败', 500);
    }
  });

  /**
   * 获取系统配置
   * GET /api/admin/system/config
   */
  getSystemConfig = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取系统配置请求', req);

      // 调用服务层获取配置
      const config = await this.adminSystemService.getSystemConfig();

      return this.sendSuccess(res, '获取系统配置成功', {
        config
      });

    } catch (error) {
      this.logError('获取系统配置失败', error, req);
      return this.sendError(res, '获取系统配置失败', 500);
    }
  });

  /**
   * 更新系统配置
   * PUT /api/admin/system/config
   */
  updateSystemConfig = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('更新系统配置请求', req);

      const configData = req.body;

      // 检查是否有配置数据
      if (!configData || Object.keys(configData).length === 0) {
        return this.sendError(res, '没有提供配置数据', 400);
      }

      // 调用服务层更新配置
      const result = await this.adminSystemService.updateSystemConfig(configData);

      return this.sendSuccess(res, '系统配置更新成功', result);

    } catch (error) {
      this.logError('更新系统配置失败', error, req);
      
      if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '更新系统配置失败', 500);
      }
    }
  });

  /**
   * 获取系统统计信息
   * GET /api/admin/system/statistics
   */
  getSystemStatistics = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取系统统计信息请求', req);

      // 调用服务层获取统计信息
      const statistics = await this.adminSystemService.getSystemStatistics(res.sequelize);

      return this.sendSuccess(res, '获取系统统计信息成功', {
        statistics
      });

    } catch (error) {
      this.logError('获取系统统计信息失败', error, req);
      return this.sendError(res, '获取系统统计信息失败', 500);
    }
  });

  /**
   * 重启应用服务
   * POST /api/admin/system/restart
   */
  restartApplication = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('重启应用服务请求', req);

      // 发送响应后再重启，避免连接中断
      res.json({
        success: true,
        message: '应用服务将在3秒后重启',
        timestamp: new Date().toISOString()
      });

      // 延迟重启
      setTimeout(() => {
        this.logger.info('管理员触发应用重启', {
          adminId: req.user?.id,
          timestamp: new Date().toISOString()
        });
        
        process.exit(0); // 在生产环境中，进程管理器会自动重启应用
      }, 3000);

    } catch (error) {
      this.logError('重启应用服务失败', error, req);
      return this.sendError(res, '重启应用服务失败', 500);
    }
  });

  /**
   * 获取API使用统计
   * GET /api/admin/system/api-stats
   */
  getApiStatistics = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取API使用统计请求', req);

      // 这里应该从日志或监控系统中获取API统计数据
      // 示例数据
      const apiStats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        topEndpoints: [],
        requestsByHour: [],
        errorsByType: {},
        lastUpdated: new Date()
      };

      return this.sendSuccess(res, '获取API使用统计成功', {
        statistics: apiStats
      });

    } catch (error) {
      this.logError('获取API使用统计失败', error, req);
      return this.sendError(res, '获取API使用统计失败', 500);
    }
  });

  /**
   * 导出系统数据
   * POST /api/admin/system/export
   */
  exportSystemData = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('导出系统数据请求', req);

      const { dataTypes, format = 'json' } = req.body;

      // 验证参数
      if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
        return this.sendError(res, '请指定要导出的数据类型', 400);
      }

      const validFormats = ['json', 'csv', 'xlsx'];
      if (!validFormats.includes(format)) {
        return this.sendError(res, '不支持的导出格式', 400);
      }

      // 这里应该实现数据导出逻辑
      const exportResult = {
        success: true,
        message: '数据导出任务已创建',
        taskId: this.generateId(),
        estimatedTime: '5-10分钟',
        downloadUrl: null // 导出完成后会有下载链接
      };

      return this.sendSuccess(res, '数据导出任务创建成功', exportResult);

    } catch (error) {
      this.logError('导出系统数据失败', error, req);
      return this.sendError(res, '导出系统数据失败', 500);
    }
  });

  /**
   * 获取系统性能指标
   * GET /api/admin/system/performance
   */
  getPerformanceMetrics = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取系统性能指标请求', req);

      const metrics = {
        cpu: {
          usage: process.cpuUsage(),
          loadAverage: require('os').loadavg()
        },
        memory: {
          process: process.memoryUsage(),
          system: {
            total: require('os').totalmem(),
            free: require('os').freemem()
          }
        },
        uptime: {
          process: process.uptime(),
          system: require('os').uptime()
        },
        eventLoop: {
          delay: 0 // 这里应该实现事件循环延迟检测
        },
        timestamp: new Date()
      };

      return this.sendSuccess(res, '获取系统性能指标成功', {
        metrics
      });

    } catch (error) {
      this.logError('获取系统性能指标失败', error, req);
      return this.sendError(res, '获取系统性能指标失败', 500);
    }
  });

  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = AdminSystemController;
