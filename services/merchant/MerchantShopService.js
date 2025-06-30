/**
 * 商户店铺服务类
 * 功能：处理商户端店铺管理相关的业务逻辑，包括店铺的增删改查等
 * 继承：BaseMerchantService，获得商户端特有的功能和数据隔离能力
 * 职责：店铺数据管理、权限验证、业务规则验证
 */

// 引入商户端基础服务类，提供商户端通用功能
const BaseMerchantService = require('../base/BaseMerchantService');

class MerchantShopService extends BaseMerchantService {
  /**
   * 构造函数：初始化商户店铺服务
   * 调用父类构造函数并设置店铺相关配置
   */
  constructor() {
    // 调用父类构造函数，获得商户端基础功能
    super();
    
    // 店铺相关配置
    this.maxShopsPerMerchant = 10; // 每个商户最多可创建的店铺数量
    this.shopModelName = 'Shop'; // 店铺模型名称
  }

  /**
   * 获取商户店铺列表
   * @param {Object} queryConditions - 查询条件
   * @param {Object} pagination - 分页参数
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 店铺列表和总数
   */
  async getShops(queryConditions, pagination, sequelize) {
    try {
      this.logInfo('获取商户店铺列表', { 
        merchantId: queryConditions.merchantId,
        pagination 
      });

      // 使用基础服务的分页查询方法
      const result = await this.handleMerchantPagination(
        queryConditions,
        pagination,
        sequelize,
        this.shopModelName,
        {
          attributes: [
            'id', 'name', 'description', 'address', 'phone', 
            'status', 'merchantId', 'createdAt', 'updatedAt'
          ],
          order: [['createdAt', 'DESC']]
        }
      );

      this.logInfo('获取商户店铺列表成功', { 
        merchantId: queryConditions.merchantId,
        total: result.total,
        count: result.data.length
      });

      return {
        shops: result.data,
        total: result.total
      };

    } catch (error) {
      this.logError('获取商户店铺列表失败', error, { 
        merchantId: queryConditions.merchantId 
      });
      throw error;
    }
  }

  /**
   * 根据ID获取店铺详情
   * @param {number} shopId - 店铺ID
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 店铺详情
   */
  async getShopById(shopId, merchantId, sequelize) {
    try {
      this.logInfo('获取店铺详情', { shopId, merchantId });

      // 获取店铺模型
      const Shop = sequelize.models[this.shopModelName];
      if (!Shop) {
        throw new Error(`店铺模型 ${this.shopModelName} 不存在`);
      }

      // 查找店铺
      const shop = await Shop.findOne({
        where: {
          id: shopId,
          merchantId: merchantId
        },
        attributes: [
          'id', 'name', 'description', 'address', 'phone', 
          'status', 'merchantId', 'createdAt', 'updatedAt'
        ]
      });

      if (!shop) {
        this.logInfo('店铺不存在', { shopId, merchantId });
        return null;
      }

      this.logInfo('获取店铺详情成功', { shopId, merchantId });
      return shop;

    } catch (error) {
      this.logError('获取店铺详情失败', error, { shopId, merchantId });
      throw error;
    }
  }

  /**
   * 创建新店铺
   * @param {Object} shopData - 店铺数据
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 创建的店铺对象
   */
  async createShop(shopData, sequelize) {
    try {
      const { merchantId, name } = shopData;
      
      this.logInfo('创建店铺', { merchantId, name });

      // 获取店铺模型
      const Shop = sequelize.models[this.shopModelName];
      if (!Shop) {
        throw new Error(`店铺模型 ${this.shopModelName} 不存在`);
      }

      // 检查商户店铺数量限制
      const existingShopsCount = await Shop.count({
        where: {
          merchantId: merchantId,
          deletedAt: null // 排除已删除的店铺
        }
      });

      if (existingShopsCount >= this.maxShopsPerMerchant) {
        throw new Error(`每个商户最多只能创建${this.maxShopsPerMerchant}个店铺`);
      }

      // 检查店铺名称是否在该商户下重复
      const existingShop = await Shop.findOne({
        where: {
          name: name,
          merchantId: merchantId,
          deletedAt: null
        }
      });

      if (existingShop) {
        throw new Error('店铺名称已存在');
      }

      // 验证店铺数据
      this.validateShopData(shopData);

      // 使用基础服务创建店铺
      const shop = await this.createMerchantData(
        shopData,
        merchantId,
        sequelize,
        this.shopModelName
      );

      // 更新商户的店铺ID列表（如果用户模型中有shopIds字段）
      await this.updateMerchantShopIds(merchantId, shop.id, 'add', sequelize);

      this.logInfo('创建店铺成功', { 
        shopId: shop.id, 
        merchantId, 
        name 
      });

      return shop;

    } catch (error) {
      this.logError('创建店铺失败', error, { 
        merchantId: shopData.merchantId, 
        name: shopData.name 
      });
      throw error;
    }
  }

  /**
   * 更新店铺信息
   * @param {number} shopId - 店铺ID
   * @param {number} merchantId - 商户ID
   * @param {Object} updateData - 更新数据
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 更新后的店铺对象
   */
  async updateShop(shopId, merchantId, updateData, sequelize) {
    try {
      this.logInfo('更新店铺信息', { shopId, merchantId });

      // 如果更新店铺名称，检查是否重复
      if (updateData.name) {
        const Shop = sequelize.models[this.shopModelName];
        const existingShop = await Shop.findOne({
          where: {
            name: updateData.name,
            merchantId: merchantId,
            id: { $ne: shopId }, // 排除当前店铺
            deletedAt: null
          }
        });

        if (existingShop) {
          throw new Error('店铺名称已存在');
        }
      }

      // 验证更新数据
      this.validateShopUpdateData(updateData);

      // 使用基础服务更新店铺
      const updatedShop = await this.updateMerchantData(
        shopId,
        merchantId,
        updateData,
        sequelize,
        this.shopModelName
      );

      this.logInfo('更新店铺信息成功', { shopId, merchantId });
      return updatedShop;

    } catch (error) {
      this.logError('更新店铺信息失败', error, { shopId, merchantId });
      throw error;
    }
  }

  /**
   * 删除店铺
   * @param {number} shopId - 店铺ID
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @returns {boolean} 删除结果
   */
  async deleteShop(shopId, merchantId, sequelize) {
    try {
      this.logInfo('删除店铺', { shopId, merchantId });

      // 检查店铺是否有关联数据（如商品）
      await this.checkShopDependencies(shopId, sequelize);

      // 使用基础服务删除店铺（软删除）
      const result = await this.deleteMerchantData(
        shopId,
        merchantId,
        sequelize,
        this.shopModelName,
        false // 软删除
      );

      if (result) {
        // 从商户的店铺ID列表中移除
        await this.updateMerchantShopIds(merchantId, shopId, 'remove', sequelize);
      }

      this.logInfo('删除店铺成功', { shopId, merchantId });
      return result;

    } catch (error) {
      this.logError('删除店铺失败', error, { shopId, merchantId });
      throw error;
    }
  }

  /**
   * 获取店铺统计信息
   * @param {number} shopId - 店铺ID
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 店铺统计信息
   */
  async getShopStats(shopId, merchantId, sequelize) {
    try {
      this.logInfo('获取店铺统计信息', { shopId, merchantId });

      // 验证店铺权限
      const shop = await this.getShopById(shopId, merchantId, sequelize);
      if (!shop) {
        throw new Error('店铺不存在');
      }

      // 获取商品统计（如果有商品模型）
      let productStats = { total: 0, active: 0, inactive: 0 };
      try {
        const Product = sequelize.models.Product;
        if (Product) {
          const [total, active, inactive] = await Promise.all([
            Product.count({ where: { shopId, deletedAt: null } }),
            Product.count({ where: { shopId, status: 1, deletedAt: null } }),
            Product.count({ where: { shopId, status: 0, deletedAt: null } })
          ]);
          productStats = { total, active, inactive };
        }
      } catch (error) {
        this.logError('获取商品统计失败', error);
      }

      // 获取订单统计（如果有订单模型）
      let orderStats = { total: 0, pending: 0, completed: 0 };
      try {
        const Order = sequelize.models.Order;
        if (Order) {
          const [total, pending, completed] = await Promise.all([
            Order.count({ where: { shopId, deletedAt: null } }),
            Order.count({ where: { shopId, status: 0, deletedAt: null } }),
            Order.count({ where: { shopId, status: 1, deletedAt: null } })
          ]);
          orderStats = { total, pending, completed };
        }
      } catch (error) {
        this.logError('获取订单统计失败', error);
      }

      const stats = {
        shop: {
          id: shop.id,
          name: shop.name,
          status: shop.status,
          createdAt: shop.createdAt
        },
        products: productStats,
        orders: orderStats,
        lastUpdated: new Date()
      };

      this.logInfo('获取店铺统计信息成功', { shopId, merchantId });
      return stats;

    } catch (error) {
      this.logError('获取店铺统计信息失败', error, { shopId, merchantId });
      throw error;
    }
  }

  /**
   * 验证店铺数据
   * @param {Object} shopData - 店铺数据
   */
  validateShopData(shopData) {
    const { name, address, phone } = shopData;

    if (!name || name.trim().length === 0) {
      throw new Error('店铺名称不能为空');
    }

    if (name.length > 100) {
      throw new Error('店铺名称不能超过100个字符');
    }

    if (!address || address.trim().length === 0) {
      throw new Error('店铺地址不能为空');
    }

    if (address.length > 500) {
      throw new Error('店铺地址不能超过500个字符');
    }

    if (!phone || phone.trim().length === 0) {
      throw new Error('联系电话不能为空');
    }

    // 简单的电话号码格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone.replace(/[-\s]/g, ''))) {
      throw new Error('联系电话格式不正确');
    }
  }

  /**
   * 验证店铺更新数据
   * @param {Object} updateData - 更新数据
   */
  validateShopUpdateData(updateData) {
    if (updateData.name !== undefined) {
      if (!updateData.name || updateData.name.trim().length === 0) {
        throw new Error('店铺名称不能为空');
      }
      if (updateData.name.length > 100) {
        throw new Error('店铺名称不能超过100个字符');
      }
    }

    if (updateData.address !== undefined) {
      if (!updateData.address || updateData.address.trim().length === 0) {
        throw new Error('店铺地址不能为空');
      }
      if (updateData.address.length > 500) {
        throw new Error('店铺地址不能超过500个字符');
      }
    }

    if (updateData.phone !== undefined) {
      if (!updateData.phone || updateData.phone.trim().length === 0) {
        throw new Error('联系电话不能为空');
      }
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(updateData.phone.replace(/[-\s]/g, ''))) {
        throw new Error('联系电话格式不正确');
      }
    }

    if (updateData.status !== undefined) {
      if (![0, 1].includes(updateData.status)) {
        throw new Error('店铺状态值无效');
      }
    }
  }

  /**
   * 检查店铺依赖关系
   * @param {number} shopId - 店铺ID
   * @param {Object} sequelize - 数据库连接对象
   */
  async checkShopDependencies(shopId, sequelize) {
    try {
      // 检查是否有关联的商品
      const Product = sequelize.models.Product;
      if (Product) {
        const productCount = await Product.count({
          where: {
            shopId: shopId,
            deletedAt: null
          }
        });

        if (productCount > 0) {
          throw new Error('店铺存在关联商品，无法删除');
        }
      }

      // 检查是否有关联的订单
      const Order = sequelize.models.Order;
      if (Order) {
        const orderCount = await Order.count({
          where: {
            shopId: shopId,
            deletedAt: null
          }
        });

        if (orderCount > 0) {
          throw new Error('店铺存在关联订单，无法删除');
        }
      }

    } catch (error) {
      throw error;
    }
  }

  /**
   * 更新商户的店铺ID列表
   * @param {number} merchantId - 商户ID
   * @param {number} shopId - 店铺ID
   * @param {string} action - 操作类型：'add' 或 'remove'
   * @param {Object} sequelize - 数据库连接对象
   */
  async updateMerchantShopIds(merchantId, shopId, action, sequelize) {
    try {
      const User = sequelize.models.User || sequelize.models.user;
      if (!User) {
        return; // 如果没有用户模型，跳过
      }

      const merchant = await User.findOne({
        where: {
          merchantId: merchantId,
          userType: 'merchant'
        }
      });

      if (!merchant) {
        return; // 如果找不到商户，跳过
      }

      let shopIds = merchant.shopIds || [];
      
      if (action === 'add' && !shopIds.includes(shopId)) {
        shopIds.push(shopId);
      } else if (action === 'remove') {
        shopIds = shopIds.filter(id => id !== shopId);
      }

      await merchant.update({ shopIds });

    } catch (error) {
      this.logError('更新商户店铺ID列表失败', error, { merchantId, shopId, action });
      // 不抛出错误，因为这不是关键操作
    }
  }
}

// 导出商户店铺服务类，供控制器使用
module.exports = MerchantShopService;
