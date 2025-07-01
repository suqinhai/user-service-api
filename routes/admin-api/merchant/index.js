// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理管理端用户管理相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈和工厂函数
const { stacks, factories } = require('../../../middleware');
// 从控制器模块引入管理端用户管理控制器类
const { AdminUserController } = require('../../../controllers');

// 创建管理端用户管理控制器实例，用于处理具体的用户管理业务逻辑
const adminUserController = new AdminUserController();

// 获取用户列表路由：需要用户读取权限，支持分页、搜索和过滤
router.get('/create', factories.createAdminPermissionStack(['user:read']), adminUserController.getUserList);

// 导出路由器，供上级路由使用
module.exports = router;
