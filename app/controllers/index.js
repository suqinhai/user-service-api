/**
 * 控制器模块统一导出文件
 * 功能：集中管理和导出所有控制器类，便于在路由模块中统一引用
 * 架构：采用分层导出，区分基础、用户端和管理端控制器
 */
// 引入基础控制器：提供通用的控制器基类和公共方法
const BaseController = require('./base/BaseController');
const BaseMerchantController = require('./base/BaseMerchantController');

// 引入管理端控制器：处理面向管理员的业务逻辑
const AdminAuthController = require('./admin/AdminAuthController');   // 总台登录控制器
const CountryController = require('./base/CountryController');   // 国家控制器
const CurrencyController = require('./base/CurrencyController'); // 货币控制器
const LanguageController = require('./base/LanguageController'); // 语言控制器


// 引入商户端控制器：处理面向商户用户的业务逻辑
const MerchantAuthController = require('./merchant/MerchantAuthController');         // 商户认证控制器
const MerchantSecurityController = require('./merchant/MerchantSecurityController');         // 商户安全控制器

// 引入用户端控制器：处理面向普通用户的业务逻辑
const UserAuthController = require('./user/UserAuthController');         // 用户认证控制器
// const UserProfileController = require('./user/UserProfileController');   // 用户资料控制器

// 导出所有控制器，使用对象结构便于按需引入
module.exports = {
  // 基础控制器：提供通用功能和继承基类
  BaseController,
  BaseMerchantController,

  // 用户端控制器：处理用户相关的HTTP请求
  UserAuthController,
  CountryController,
  CurrencyController,
  LanguageController,

  // 管理端控制器：处理管理员相关的HTTP请求
  AdminAuthController,

  // 商户端控制器：处理商户相关的HTTP请求
  MerchantAuthController,
  MerchantSecurityController,
};
