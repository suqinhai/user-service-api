/**
 * 商户端基础服务类
 * 功能：为商户端服务提供通用的基础功能和商户特定的业务逻辑
 * 继承：BaseService，获得统一的数据处理和错误处理能力
 * 扩展：添加商户数据隔离、权限验证等商户端特有功能
 */

// 引入基础服务类，提供通用的服务功能
const BaseService = require('./BaseService');
const { MERCHANT_STATUS, COMMON_STATUS } = require('../../../common/constants/status');

class BaseMerchantService extends BaseService {
  /**
   * 构造函数：初始化商户端基础服务
   * 调用父类构造函数并设置商户端特有配置
   */
  constructor() {
    // 调用父类构造函数，获得基础功能
    super();
    
    // 商户端特有配置
    this.serviceType = 'merchant';
    this.requireMerchantAuth = COMMON_STATUS.YES;
  }

  /**
   * 验证商户权限
   * 确保操作的数据属于指定商户
   * @param {number} merchantId - 商户ID
   * @param {Object} data - 要验证的数据对象
   * @param {string} merchantField - 数据对象中商户ID字段名，默认为'merchantId'
   * @returns {boolean} 验证结果
   */
  validateMerchantOwnership(merchantId, data, merchantField = 'merchantId') {
    if (!merchantId) {
      throw new Error('商户ID不能为空');
    }

    if (!data) {
      throw new Error('验证数据不能为空');
    }

    if (data[merchantField] !== merchantId) {
      throw new Error('无权访问该数据');
    }

    return COMMON_STATUS.SUCCESS;
  }

  /**
   * 验证店铺权限
   * 确保操作的店铺属于指定商户
   * @param {number} merchantId - 商户ID
   * @param {number} shopId - 店铺ID
   * @param {Array} allowedShopIds - 商户允许访问的店铺ID列表
   * @returns {boolean} 验证结果
   */
  validateShopOwnership(merchantId, shopId, allowedShopIds = []) {
    if (!merchantId) {
      throw new Error('商户ID不能为空');
    }

    if (!shopId) {
      throw new Error('店铺ID不能为空');
    }

    // 如果提供了允许的店铺ID列表，则检查店铺ID是否在列表中
    if (allowedShopIds.length > 0 && !allowedShopIds.includes(parseInt(shopId))) {
      throw new Error('无权访问该店铺');
    }

    return true;
  }

  /**
   * 构建商户查询条件
   * 为数据库查询添加商户数据隔离条件
   * @param {number} merchantId - 商户ID
   * @param {Object} baseConditions - 基础查询条件
   * @returns {Object} 包含商户隔离的查询条件
   */
  buildMerchantQuery(merchantId, baseConditions = {}) {
    if (!merchantId) {
      throw new Error('商户ID不能为空');
    }

    return {
      ...baseConditions,
      merchantId: merchantId
    };
  }

  /**
   * 构建店铺查询条件
   * 为数据库查询添加店铺数据隔离条件
   * @param {number} merchantId - 商户ID
   * @param {Object} baseConditions - 基础查询条件
   * @param {number|Array} shopIds - 店铺ID或店铺ID数组（可选）
   * @returns {Object} 包含店铺隔离的查询条件
   */
  buildShopQuery(merchantId, baseConditions = {}, shopIds = null) {
    if (!merchantId) {
      throw new Error('商户ID不能为空');
    }

    const query = {
      ...baseConditions,
      merchantId: merchantId
    };

    // 如果指定了店铺ID
    if (shopIds !== null) {
      if (Array.isArray(shopIds)) {
        if (shopIds.length > 0) {
          query.shopId = { $in: shopIds };
        }
      } else {
        query.shopId = shopIds;
      }
    }

    return query;
  }

  /**
   * 处理商户分页查询
   * 为商户端查询添加分页和排序逻辑
   * @param {Object} queryConditions - 查询条件
   * @param {Object} pagination - 分页参数 {page, limit, offset}
   * @param {Object} sequelize - 数据库连接对象
   * @param {string} modelName - 模型名称
   * @param {Object} options - 查询选项
   * @returns {Object} 查询结果 {data, total}
   */
  async handleMerchantPagination(queryConditions, pagination, sequelize, modelName, options = {}) {
    try {
      const {
        include = [],
        attributes = null,
        order = [['createdAt', 'DESC']],
        raw = false
      } = options;

      // 获取模型
      const Model = sequelize.models[modelName];
      if (!Model) {
        throw new Error(`模型 ${modelName} 不存在`);
      }

      // 构建查询选项
      const queryOptions = {
        where: queryConditions,
        limit: pagination.limit,
        offset: pagination.offset,
        order: order,
        raw: raw
      };

      if (attributes) {
        queryOptions.attributes = attributes;
      }

      if (include.length > 0) {
        queryOptions.include = include;
      }

      // 执行查询
      const { count, rows } = await Model.findAndCountAll(queryOptions);

      return {
        data: rows,
        total: count
      };

    } catch (error) {
      this.logError('商户分页查询失败', error);
      throw error;
    }
  }

  /**
   * 创建商户数据
   * 为新创建的数据自动添加商户ID
   * @param {Object} data - 要创建的数据
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @param {string} modelName - 模型名称
   * @returns {Object} 创建的数据对象
   */
  async createMerchantData(data, merchantId, sequelize, modelName) {
    try {
      if (!merchantId) {
        throw new Error('商户ID不能为空');
      }

      // 获取模型
      const Model = sequelize.models[modelName];
      if (!Model) {
        throw new Error(`模型 ${modelName} 不存在`);
      }

      // 添加商户ID到数据中
      const dataWithMerchant = {
        ...data,
        merchantId: merchantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 创建数据
      const result = await Model.create(dataWithMerchant);
      
      this.logInfo(`商户数据创建成功`, { 
        modelName, 
        merchantId, 
        dataId: result.id 
      });

      return result;

    } catch (error) {
      this.logError('创建商户数据失败', error, { modelName, merchantId });
      throw error;
    }
  }

  /**
   * 更新商户数据
   * 确保只能更新属于指定商户的数据
   * @param {number} dataId - 数据ID
   * @param {number} merchantId - 商户ID
   * @param {Object} updateData - 更新数据
   * @param {Object} sequelize - 数据库连接对象
   * @param {string} modelName - 模型名称
   * @returns {Object} 更新后的数据对象
   */
  async updateMerchantData(dataId, merchantId, updateData, sequelize, modelName) {
    try {
      if (!dataId || !merchantId) {
        throw new Error('数据ID和商户ID不能为空');
      }

      // 获取模型
      const Model = sequelize.models[modelName];
      if (!Model) {
        throw new Error(`模型 ${modelName} 不存在`);
      }

      // 先查找数据，确保存在且属于该商户
      const existingData = await Model.findOne({
        where: {
          id: dataId,
          merchantId: merchantId
        }
      });

      if (!existingData) {
        throw new Error('数据不存在或无权访问');
      }

      // 添加更新时间
      const dataWithTimestamp = {
        ...updateData,
        updatedAt: new Date()
      };

      // 执行更新
      await Model.update(dataWithTimestamp, {
        where: {
          id: dataId,
          merchantId: merchantId
        }
      });

      // 返回更新后的数据
      const updatedData = await Model.findByPk(dataId);
      
      this.logInfo(`商户数据更新成功`, { 
        modelName, 
        merchantId, 
        dataId 
      });

      return updatedData;

    } catch (error) {
      this.logError('更新商户数据失败', error, { modelName, merchantId, dataId });
      throw error;
    }
  }

  /**
   * 删除商户数据
   * 确保只能删除属于指定商户的数据（软删除）
   * @param {number} dataId - 数据ID
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @param {string} modelName - 模型名称
   * @param {boolean} hardDelete - 是否硬删除，默认为false（软删除）
   * @returns {boolean} 删除结果
   */
  async deleteMerchantData(dataId, merchantId, sequelize, modelName, hardDelete = false) {
    try {
      if (!dataId || !merchantId) {
        throw new Error('数据ID和商户ID不能为空');
      }

      // 获取模型
      const Model = sequelize.models[modelName];
      if (!Model) {
        throw new Error(`模型 ${modelName} 不存在`);
      }

      // 先查找数据，确保存在且属于该商户
      const existingData = await Model.findOne({
        where: {
          id: dataId,
          merchantId: merchantId
        }
      });

      if (!existingData) {
        throw new Error('数据不存在或无权访问');
      }

      let result;
      if (hardDelete) {
        // 硬删除
        result = await Model.destroy({
          where: {
            id: dataId,
            merchantId: merchantId
          }
        });
      } else {
        // 软删除（更新删除标记）
        result = await Model.update({
          deletedAt: new Date(),
          updatedAt: new Date()
        }, {
          where: {
            id: dataId,
            merchantId: merchantId
          }
        });
      }

      this.logInfo(`商户数据删除成功`, { 
        modelName, 
        merchantId, 
        dataId, 
        hardDelete 
      });

      return result > 0;

    } catch (error) {
      this.logError('删除商户数据失败', error, { modelName, merchantId, dataId });
      throw error;
    }
  }

  /**
   * 批量操作商户数据
   * 确保只能操作属于指定商户的数据
   * @param {Array} dataIds - 数据ID数组
   * @param {number} merchantId - 商户ID
   * @param {Object} updateData - 更新数据
   * @param {Object} sequelize - 数据库连接对象
   * @param {string} modelName - 模型名称
   * @returns {Object} 批量操作结果 {successCount, failedIds}
   */
  async batchUpdateMerchantData(dataIds, merchantId, updateData, sequelize, modelName) {
    try {
      if (!Array.isArray(dataIds) || dataIds.length === 0) {
        throw new Error('数据ID数组不能为空');
      }

      if (!merchantId) {
        throw new Error('商户ID不能为空');
      }

      // 获取模型
      const Model = sequelize.models[modelName];
      if (!Model) {
        throw new Error(`模型 ${modelName} 不存在`);
      }

      // 先查找所有属于该商户的数据
      const existingData = await Model.findAll({
        where: {
          id: { $in: dataIds },
          merchantId: merchantId
        },
        attributes: ['id']
      });

      const existingIds = existingData.map(item => item.id);
      const failedIds = dataIds.filter(id => !existingIds.includes(id));

      // 执行批量更新
      const dataWithTimestamp = {
        ...updateData,
        updatedAt: new Date()
      };

      const [affectedCount] = await Model.update(dataWithTimestamp, {
        where: {
          id: { $in: existingIds },
          merchantId: merchantId
        }
      });

      this.logInfo(`商户数据批量更新成功`, { 
        modelName, 
        merchantId, 
        successCount: affectedCount,
        failedCount: failedIds.length
      });

      return {
        successCount: affectedCount,
        failedIds: failedIds
      };

    } catch (error) {
      this.logError('批量更新商户数据失败', error, { modelName, merchantId });
      throw error;
    }
  }
}

// 导出商户端基础服务类，供商户端服务继承使用
module.exports = BaseMerchantService;
