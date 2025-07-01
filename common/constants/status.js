/**
 * 系统状态常量定义
 * 功能：统一管理所有状态、角色、配置项的数字常量
 * 说明：将所有boolean和枚举类型统一为数字类型，提高性能和一致性
 */

// 通用状态常量
const COMMON_STATUS = {
  // 禁用/启用状态
  DISABLED: 0,    // 禁用
  ENABLED: 1,     // 启用
  
  // 激活状态
  INACTIVE: 0,    // 未激活
  ACTIVE: 1,      // 已激活
  
  // 成功/失败状态
  FAILED: 0,      // 失败
  SUCCESS: 1,     // 成功
  
  // 是/否状态
  NO: 0,          // 否
  YES: 1          // 是
};

// 用户相关状态常量
const USER_STATUS = {
  // 用户状态
  INACTIVE: 0,    // 未激活
  ACTIVE: 1,      // 已激活
  SUSPENDED: 2,   // 已暂停
  BANNED: 3,      // 已封禁
  DELETED: 4      // 已删除
};

// 用户角色常量
const USER_ROLE = {
  USER: 10,        // h5用户
  MERCHANT: 20,    // 商户
  CONSOLE_ADMIN: 30 // 总台管理员
};

// 商户相关状态常量
const MERCHANT_STATUS = {
  DISABLED: 0,    // 禁用
  ACTIVE: 1,      // 正常
  PENDING: 2,     // 审核中
  REJECTED: 3,    // 审核拒绝
  SUSPENDED: 4    // 暂停营业
};

// 店铺状态常量
const SHOP_STATUS = {
  DISABLED: 0,    // 禁用
  ACTIVE: 1,      // 启用
  MAINTENANCE: 2, // 维护中
  CLOSED: 3       // 已关闭
};

// 商品状态常量
const PRODUCT_STATUS = {
  OFFLINE: 0,     // 下架
  ONLINE: 1,      // 上架
  OUT_OF_STOCK: 2,// 缺货
  DISCONTINUED: 3 // 停产
};

// 注册配置常量
const REGISTER_CONFIG = {
  // 验证开关
  VERIFICATION_OFF: 0,    // 关闭验证
  VERIFICATION_ON: 1,     // 开启验证
  
  // 必填开关
  NOT_REQUIRED: 0,        // 非必填
  REQUIRED: 1,            // 必填
  
  // 验证码类型
  CAPTCHA_NONE: 0,        // 无验证码
  CAPTCHA_IMAGE: 1,       // 图形验证码
  CAPTCHA_NUMERIC: 2,     // 数字验证码
  CAPTCHA_SMS: 3          // 短信验证码
};

// 认证状态常量
const AUTH_STATUS = {
  NOT_AUTHENTICATED: 0,   // 未认证
  AUTHENTICATED: 1,       // 已认证
  TOKEN_EXPIRED: 2,       // 令牌过期
  TOKEN_INVALID: 3        // 令牌无效
};

// 权限级别常量
const PERMISSION_LEVEL = {
  NONE: 0,        // 无权限
  READ: 1,        // 只读权限
  WRITE: 2,       // 读写权限
  ADMIN: 3,       // 管理权限
  SUPER: 4        // 超级权限
};

// 操作结果常量
const OPERATION_RESULT = {
  FAILED: 0,      // 操作失败
  SUCCESS: 1,     // 操作成功
  PARTIAL: 2,     // 部分成功
  PENDING: 3      // 等待处理
};

// 数据状态常量
const DATA_STATUS = {
  DELETED: 0,     // 已删除
  NORMAL: 1,      // 正常
  ARCHIVED: 2,    // 已归档
  DRAFT: 3        // 草稿
};

// 导出所有常量
module.exports = {
  COMMON_STATUS,
  USER_STATUS,
  USER_ROLE,
  MERCHANT_STATUS,
  SHOP_STATUS,
  PRODUCT_STATUS,
  REGISTER_CONFIG,
  AUTH_STATUS,
  PERMISSION_LEVEL,
  OPERATION_RESULT,
  DATA_STATUS,
  
  // 为了向后兼容，提供一些常用的别名
  STATUS: COMMON_STATUS,
  ROLE: USER_ROLE
};
