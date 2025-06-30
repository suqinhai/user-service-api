// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理管理端API路由
const router = express.Router();

// 管理端API根路由处理函数，返回API服务状态和可用端点信息
router.get('/', function(req, res) {
  // 使用统一的成功响应方法返回管理端API信息
  res.sendSuccess('管理端API服务正常', {
    data: {
      type: 'admin',  // API类型标识
      description: '管理端接口，提供系统管理功能',  // API描述
      // 列出所有可用的管理端API端点
      availableEndpoints: [
        '/api/admin/users',   // 用户管理相关接口
        '/api/admin/system'   // 系统管理相关接口
      ]
    }
  });
});

// 从中间件模块引入管理端专用中间件
const { adminApi } = require('../../middleware');

// 将管理端基础中间件应用到所有子路由，包括管理员认证、权限验证等
router.use(adminApi);

// 引入管理端子路由模块
const usersRouter = require('./users');    // 用户管理路由
const systemRouter = require('./system');  // 系统管理路由

// 注册子路由到对应的路径
router.use('/users', usersRouter);   // 注册用户管理路由，路径为/api/admin/users
router.use('/system', systemRouter); // 注册系统管理路由，路径为/api/admin/system

// 导出路由器，供上级路由使用
module.exports = router;
