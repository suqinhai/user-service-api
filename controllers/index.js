/**
 * 控制器模块统一导出文件
 * 功能：集中管理和导出所有控制器类，便于在路由模块中统一引用
 * 架构：采用分层导出，区分基础、用户端和管理端控制器
 */

// 引入用户端控制器：处理面向普通用户的业务逻辑
const UserAuthController = require('./user/UserAuthController');         // 用户认证控制器
const UserProfileController = require('./user/UserProfileController');   // 用户资料控制器

// 引入管理端控制器：处理面向管理员的业务逻辑
// const AdminUserController = require('./admin/AdminUserController');       // 管理端用户管理控制器
// const AdminSystemController = require('./admin/AdminSystemController');   // 管理端系统管理控制器
// const ConsoleAuthController = require('./admin/ConsoleAuthController');   // 总台认证控制器
const LoginAuthController = require('./admin/LoginAuthController');   // 总台登录控制器


// 引入商户端控制器：处理面向商户用户的业务逻辑
const MerchantAuthController = require('./merchant/MerchantAuthController');         // 商户认证控制器
const MerchantShopController = require('./merchant/MerchantShopController');         // 商户店铺管理控制器
const MerchantProductController = require('./merchant/MerchantProductController');   // 商户商品管理控制器

// 引入基础控制器：提供通用的控制器基类和公共方法
const BaseController = require('./base/BaseController');
const BaseMerchantController = require('./base/BaseMerchantController');

// 导出所有控制器，使用对象结构便于按需引入
module.exports = {
  // 基础控制器：提供通用功能和继承基类
  BaseController,
  BaseMerchantController,

  // 用户端控制器：处理用户相关的HTTP请求
  UserAuthController,      // 用户认证：登录、注册、令牌管理
  UserProfileController,   // 用户资料：个人信息管理、头像上传

  // 管理端控制器：处理管理员相关的HTTP请求
  // AdminUserController,     // 用户管理：用户CRUD、状态管理、权限控制
  // AdminSystemController,   // 系统管理：系统信息、日志、配置、性能监控
  // ConsoleAuthController,   // 总台认证：总台管理员登录、令牌管理、状态查询
  LoginAuthController,

  // 商户端控制器：处理商户相关的HTTP请求
  MerchantAuthController,     // 商户认证：登录、注册、令牌管理
  MerchantShopController,     // 店铺管理：店铺CRUD、状态管理
  MerchantProductController   // 商品管理：商品CRUD、库存管理、批量操作
};
