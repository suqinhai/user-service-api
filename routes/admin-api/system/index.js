// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理管理端系统管理相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈和工厂函数
const { stacks, factories } = require('../../../middleware');
// 从控制器模块引入管理端系统管理控制器类
const { AdminSystemController } = require('../../../controllers');

// 创建管理端系统管理控制器实例，用于处理具体的系统管理业务逻辑
const adminSystemController = new AdminSystemController();

// 获取系统信息路由：需要系统读取权限，返回系统版本、运行时间、环境等基本信息
router.get('/info', factories.createAdminPermissionStack(['system:read']), adminSystemController.getSystemInfo);

// 获取系统统计信息路由：需要系统读取权限，返回用户统计、请求统计等数据
router.get('/statistics', factories.createAdminPermissionStack(['system:read']), adminSystemController.getSystemStatistics);

// 获取系统日志路由：需要系统读取权限，支持按级别和时间范围查询系统日志
router.get('/logs', factories.createAdminPermissionStack(['system:read']), adminSystemController.getSystemLogs);

// 清除系统缓存路由：需要敏感操作权限，可以清除指定类型或全部缓存
router.post('/cache/clear', stacks.admin.sensitive, adminSystemController.clearSystemCache);

// 获取系统健康状态路由：需要系统读取权限，检查数据库、Redis等服务状态
router.get('/health', factories.createAdminPermissionStack(['system:read']), adminSystemController.getHealthStatus);
// 获取系统配置路由：需要系统读取权限，返回当前系统配置信息
router.get('/config', factories.createAdminPermissionStack(['system:read']), adminSystemController.getSystemConfig);
// 更新系统配置路由：需要敏感操作权限，允许修改系统配置参数
router.put('/config', stacks.admin.sensitive, adminSystemController.updateSystemConfig);
// 重启应用路由：需要超级管理员权限，重启整个应用服务（极危险操作）
router.post('/restart', stacks.admin.superAdmin, adminSystemController.restartApplication);
// 获取API统计信息路由：需要系统读取权限，返回API调用统计和性能数据
router.get('/api-stats', factories.createAdminPermissionStack(['system:read']), adminSystemController.getApiStatistics);
// 导出系统数据路由：需要超级管理员权限，导出系统数据用于备份或迁移
router.post('/export', stacks.admin.superAdmin, adminSystemController.exportSystemData);
// 获取性能指标路由：需要系统读取权限，返回CPU、内存、响应时间等性能指标
router.get('/performance', factories.createAdminPermissionStack(['system:read']), adminSystemController.getPerformanceMetrics);

// 导出路由器，供上级路由使用
module.exports = router;
