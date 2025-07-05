// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，用于组织和管理API路由
const router = express.Router();

// 引入用户端API路由模块，处理面向普通用户的接口
const userRouter = require('./user-api');
// 引入管理端API路由模块，处理面向管理员的接口
const adminRouter = require('./admin-api');
// 引入商户端API路由模块，处理面向商户用户的接口
const merchantRouter = require('./merchant-api');

// 注册用户端路由，所有用户相关的API都以/user为前缀
router.use('/user', userRouter);
// 注册管理端路由，所有管理相关的API都以/admin为前缀
router.use('/admin', adminRouter);
// 注册商户端路由，所有商户相关的API都以/merchant为前缀
router.use('/merchant', merchantRouter);

// 导出路由器，供主应用使用
module.exports = router;