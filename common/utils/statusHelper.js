/**
 * 状态工具函数
 * 功能：提供状态转换、验证、格式化等工具方法
 * 说明：帮助在数字状态和字符串描述之间进行转换
 */

const {
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
  DATA_STATUS
} = require('../constants/status');

/**
 * 状态描述映射
 */
const STATUS_DESCRIPTIONS = {
  // 用户状态描述
  USER_STATUS: {
    [USER_STATUS.INACTIVE]: '未激活',
    [USER_STATUS.ACTIVE]: '已激活',
    [USER_STATUS.SUSPENDED]: '已暂停',
    [USER_STATUS.BANNED]: '已封禁',
    [USER_STATUS.DELETED]: '已删除'
  },
  
  // 用户角色描述
  USER_ROLE: {
    [USER_ROLE.USER]: '普通用户',
    [USER_ROLE.ADMIN]: '管理员',
    [USER_ROLE.SUPER_ADMIN]: '超级管理员',
    [USER_ROLE.MODERATOR]: '版主'
  },
  
  // 商户状态描述
  MERCHANT_STATUS: {
    [MERCHANT_STATUS.DISABLED]: '禁用',
    [MERCHANT_STATUS.ACTIVE]: '正常',
    [MERCHANT_STATUS.PENDING]: '审核中',
    [MERCHANT_STATUS.REJECTED]: '审核拒绝',
    [MERCHANT_STATUS.SUSPENDED]: '暂停营业'
  },
  
  // 店铺状态描述
  SHOP_STATUS: {
    [SHOP_STATUS.DISABLED]: '禁用',
    [SHOP_STATUS.ACTIVE]: '启用',
    [SHOP_STATUS.MAINTENANCE]: '维护中',
    [SHOP_STATUS.CLOSED]: '已关闭'
  },
  
  // 商品状态描述
  PRODUCT_STATUS: {
    [PRODUCT_STATUS.OFFLINE]: '下架',
    [PRODUCT_STATUS.ONLINE]: '上架',
    [PRODUCT_STATUS.OUT_OF_STOCK]: '缺货',
    [PRODUCT_STATUS.DISCONTINUED]: '停产'
  }
};

/**
 * 旧枚举值到新数字值的映射（用于数据迁移和兼容性）
 */
const LEGACY_MAPPING = {
  // 用户状态映射
  USER_STATUS: {
    'inactive': USER_STATUS.INACTIVE,
    'active': USER_STATUS.ACTIVE,
    'suspended': USER_STATUS.SUSPENDED,
    'banned': USER_STATUS.BANNED,
    'deleted': USER_STATUS.DELETED
  },
  
  // 用户角色映射
  USER_ROLE: {
    'user': USER_ROLE.USER,
    'admin': USER_ROLE.ADMIN,
    'super_admin': USER_ROLE.SUPER_ADMIN,
    'moderator': USER_ROLE.MODERATOR
  }
};

/**
 * 工具函数类
 */
class StatusHelper {
  /**
   * 获取状态描述
   * @param {string} type - 状态类型
   * @param {number} value - 状态值
   * @returns {string} 状态描述
   */
  static getDescription(type, value) {
    const descriptions = STATUS_DESCRIPTIONS[type];
    return descriptions ? descriptions[value] || '未知状态' : '未知类型';
  }
  
  /**
   * 验证状态值是否有效
   * @param {string} type - 状态类型
   * @param {number} value - 状态值
   * @returns {boolean} 是否有效
   */
  static isValidStatus(type, value) {
    const descriptions = STATUS_DESCRIPTIONS[type];
    return descriptions ? descriptions.hasOwnProperty(value) : false;
  }
  
  /**
   * 将旧的字符串状态转换为新的数字状态
   * @param {string} type - 状态类型
   * @param {string} legacyValue - 旧的字符串值
   * @returns {number|null} 新的数字值或null
   */
  static convertLegacyStatus(type, legacyValue) {
    const mapping = LEGACY_MAPPING[type];
    return mapping ? mapping[legacyValue] || null : null;
  }
  
  /**
   * 检查用户是否为管理员
   * @param {number} role - 用户角色
   * @returns {boolean} 是否为管理员
   */
  static isAdmin(role) {
    return role === USER_ROLE.ADMIN || role === USER_ROLE.SUPER_ADMIN;
  }
  
  /**
   * 检查用户是否为超级管理员
   * @param {number} role - 用户角色
   * @returns {boolean} 是否为超级管理员
   */
  static isSuperAdmin(role) {
    return role === USER_ROLE.SUPER_ADMIN;
  }
  
  /**
   * 检查用户状态是否正常
   * @param {number} status - 用户状态
   * @returns {boolean} 状态是否正常
   */
  static isUserActive(status) {
    return status === USER_STATUS.ACTIVE;
  }
  
  /**
   * 检查商户状态是否正常
   * @param {number} status - 商户状态
   * @returns {boolean} 状态是否正常
   */
  static isMerchantActive(status) {
    return status === MERCHANT_STATUS.ACTIVE;
  }
  
  /**
   * 将boolean值转换为数字
   * @param {boolean} value - boolean值
   * @returns {number} 0或1
   */
  static booleanToNumber(value) {
    return value ? COMMON_STATUS.YES : COMMON_STATUS.NO;
  }
  
  /**
   * 将数字转换为boolean值
   * @param {number} value - 数字值
   * @returns {boolean} true或false
   */
  static numberToBoolean(value) {
    return value === COMMON_STATUS.YES;
  }
  
  /**
   * 获取所有状态选项（用于前端下拉框等）
   * @param {string} type - 状态类型
   * @returns {Array} 状态选项数组
   */
  static getStatusOptions(type) {
    const descriptions = STATUS_DESCRIPTIONS[type];
    if (!descriptions) return [];
    
    return Object.keys(descriptions).map(value => ({
      value: parseInt(value),
      label: descriptions[value]
    }));
  }
}

module.exports = {
  StatusHelper,
  STATUS_DESCRIPTIONS,
  LEGACY_MAPPING
};
