/**
 * 增强的用户模型
 * 使用模型缓存中间件，减少数据库查询次数
 */

const { modelCache } = require('../../middleware');
const { PREFIX, TTL } = require('../../common/redis');
const sequelize = require('../../common/mysql');
const User = require('./user')(sequelize);

// 应用缓存中间件，创建增强版本的User模型
const EnhancedUser = modelCache.autoCacheClearModel(User, {
  prefix: PREFIX.USER,
  ttl: TTL.MEDIUM, // 1小时缓存
  methods: ['findByPk', 'findOne', 'findAll'], // 缓存这些方法
  hooks: [
    'afterCreate',
    'afterUpdate',
    'afterDestroy',
    'afterBulkCreate',
    'afterBulkUpdate',
    'afterBulkDestroy'
  ] // 这些hook触发时自动清除缓存
});

/**
 * 按用户名查找用户（使用缓存）
 * @param {string} username - 用户名
 * @returns {Promise<Object>} - 用户对象
 */
EnhancedUser.findByUsername = async function(username) {
  return EnhancedUser.findOne({
    where: { username }
  });
};

/**
 * 按电子邮件查找用户（使用缓存）
 * @param {string} email - 电子邮件
 * @returns {Promise<Object>} - 用户对象
 */
EnhancedUser.findByEmail = async function(email) {
  return EnhancedUser.findOne({
    where: { email }
  });
};

/**
 * 获取活跃用户（使用缓存）
 * @param {number} limit - 限制返回数量
 * @returns {Promise<Array>} - 用户对象数组
 */
EnhancedUser.getActiveUsers = async function(limit = 10) {
  return EnhancedUser.findAll({
    where: { status: 'active' },
    limit: limit,
    order: [['created_at', 'DESC']]
  });
};

/**
 * 查找用户（绕过缓存）
 * 某些敏感或需要实时数据的场景下使用
 * @param {number} id - 用户ID
 * @returns {Promise<Object>} - 用户对象
 */
EnhancedUser.findByPkNoCache = async function(id) {
  return User.findByPk(id, { disableCache: true });
};

/**
 * 更新用户并清除相关缓存
 * @param {number} id - 用户ID
 * @param {Object} data - 要更新的数据
 * @returns {Promise<Object>} - 更新后的用户对象
 */
EnhancedUser.updateAndClearCache = async function(id, data) {
  const result = await User.update(data, {
    where: { id }
  });
  
  // 手动清除特定用户的缓存
  await EnhancedUser.clearCache(id);
  
  return result;
};

module.exports = EnhancedUser; 