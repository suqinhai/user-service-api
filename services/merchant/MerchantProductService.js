/**
 * 商户商品服务类
 * 功能：处理商户端商品管理相关的业务逻辑，包括商品的增删改查等
 * 继承：BaseMerchantService，获得商户端特有的功能和数据隔离能力
 * 职责：商品数据管理、权限验证、业务规则验证、库存管理
 */

// 引入商户端基础服务类，提供商户端通用功能
const BaseMerchantService = require('../base/BaseMerchantService');

class MerchantProductService extends BaseMerchantService {
  /**
   * 构造函数：初始化商户商品服务
   * 调用父类构造函数并设置商品相关配置
   */
  constructor() {
    // 调用父类构造函数，获得商户端基础功能
    super();
    
    // 商品相关配置
    this.maxProductsPerShop = 1000; // 每个店铺最多可创建的商品数量
    this.productModelName = 'Product'; // 商品模型名称
    this.shopModelName = 'Shop'; // 店铺模型名称
  }

  /**
   * 获取商户商品列表
   * @param {Object} queryConditions - 查询条件
   * @param {Object} pagination - 分页参数
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 商品列表和总数
   */
  async getProducts(queryConditions, pagination, sequelize) {
    try {
      this.logInfo('获取商户商品列表', { 
        merchantId: queryConditions.merchantId,
        pagination 
      });

      // 处理关键词搜索
      let whereConditions = { ...queryConditions };
      if (queryConditions.keyword) {
        const keyword = queryConditions.keyword;
        delete whereConditions.keyword;
        
        whereConditions.$or = [
          { name: { $like: `%${keyword}%` } },
          { description: { $like: `%${keyword}%` } }
        ];
      }

      // 使用基础服务的分页查询方法
      const result = await this.handleMerchantPagination(
        whereConditions,
        pagination,
        sequelize,
        this.productModelName,
        {
          attributes: [
            'id', 'name', 'description', 'price', 'originalPrice', 
            'stock', 'status', 'categoryId', 'shopId', 'merchantId',
            'images', 'createdAt', 'updatedAt'
          ],
          order: [['createdAt', 'DESC']],
          include: [
            {
              model: sequelize.models[this.shopModelName],
              as: 'shop',
              attributes: ['id', 'name'],
              required: false
            }
          ]
        }
      );

      this.logInfo('获取商户商品列表成功', { 
        merchantId: queryConditions.merchantId,
        total: result.total,
        count: result.data.length
      });

      return {
        products: result.data,
        total: result.total
      };

    } catch (error) {
      this.logError('获取商户商品列表失败', error, { 
        merchantId: queryConditions.merchantId 
      });
      throw error;
    }
  }

  /**
   * 根据ID获取商品详情
   * @param {number} productId - 商品ID
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 商品详情
   */
  async getProductById(productId, merchantId, sequelize) {
    try {
      this.logInfo('获取商品详情', { productId, merchantId });

      // 获取商品模型
      const Product = sequelize.models[this.productModelName];
      if (!Product) {
        throw new Error(`商品模型 ${this.productModelName} 不存在`);
      }

      // 查找商品
      const product = await Product.findOne({
        where: {
          id: productId,
          merchantId: merchantId
        },
        attributes: [
          'id', 'name', 'description', 'price', 'originalPrice', 
          'stock', 'status', 'categoryId', 'shopId', 'merchantId',
          'images', 'createdAt', 'updatedAt'
        ],
        include: [
          {
            model: sequelize.models[this.shopModelName],
            as: 'shop',
            attributes: ['id', 'name'],
            required: false
          }
        ]
      });

      if (!product) {
        this.logInfo('商品不存在', { productId, merchantId });
        return null;
      }

      this.logInfo('获取商品详情成功', { productId, merchantId });
      return product;

    } catch (error) {
      this.logError('获取商品详情失败', error, { productId, merchantId });
      throw error;
    }
  }

  /**
   * 创建新商品
   * @param {Object} productData - 商品数据
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 创建的商品对象
   */
  async createProduct(productData, sequelize) {
    try {
      const { merchantId, shopId, name } = productData;
      
      this.logInfo('创建商品', { merchantId, shopId, name });

      // 获取商品模型
      const Product = sequelize.models[this.productModelName];
      if (!Product) {
        throw new Error(`商品模型 ${this.productModelName} 不存在`);
      }

      // 验证店铺是否属于该商户
      await this.validateShopOwnership(merchantId, shopId, sequelize);

      // 检查店铺商品数量限制
      const existingProductsCount = await Product.count({
        where: {
          shopId: shopId,
          deletedAt: null // 排除已删除的商品
        }
      });

      if (existingProductsCount >= this.maxProductsPerShop) {
        throw new Error(`每个店铺最多只能创建${this.maxProductsPerShop}个商品`);
      }

      // 检查商品名称是否在该店铺下重复
      const existingProduct = await Product.findOne({
        where: {
          name: name,
          shopId: shopId,
          deletedAt: null
        }
      });

      if (existingProduct) {
        throw new Error('商品名称在该店铺下已存在');
      }

      // 验证商品数据
      this.validateProductData(productData);

      // 使用基础服务创建商品
      const product = await this.createMerchantData(
        productData,
        merchantId,
        sequelize,
        this.productModelName
      );

      this.logInfo('创建商品成功', { 
        productId: product.id, 
        merchantId, 
        shopId,
        name 
      });

      return product;

    } catch (error) {
      this.logError('创建商品失败', error, { 
        merchantId: productData.merchantId, 
        shopId: productData.shopId,
        name: productData.name 
      });
      throw error;
    }
  }

  /**
   * 更新商品信息
   * @param {number} productId - 商品ID
   * @param {number} merchantId - 商户ID
   * @param {Object} updateData - 更新数据
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 更新后的商品对象
   */
  async updateProduct(productId, merchantId, updateData, sequelize) {
    try {
      this.logInfo('更新商品信息', { productId, merchantId });

      // 获取当前商品信息
      const currentProduct = await this.getProductById(productId, merchantId, sequelize);
      if (!currentProduct) {
        throw new Error('商品不存在');
      }

      // 如果更新商品名称，检查是否重复
      if (updateData.name && updateData.name !== currentProduct.name) {
        const Product = sequelize.models[this.productModelName];
        const existingProduct = await Product.findOne({
          where: {
            name: updateData.name,
            shopId: currentProduct.shopId,
            id: { $ne: productId }, // 排除当前商品
            deletedAt: null
          }
        });

        if (existingProduct) {
          throw new Error('商品名称在该店铺下已存在');
        }
      }

      // 验证更新数据
      this.validateProductUpdateData(updateData);

      // 使用基础服务更新商品
      const updatedProduct = await this.updateMerchantData(
        productId,
        merchantId,
        updateData,
        sequelize,
        this.productModelName
      );

      this.logInfo('更新商品信息成功', { productId, merchantId });
      return updatedProduct;

    } catch (error) {
      this.logError('更新商品信息失败', error, { productId, merchantId });
      throw error;
    }
  }

  /**
   * 删除商品
   * @param {number} productId - 商品ID
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @returns {boolean} 删除结果
   */
  async deleteProduct(productId, merchantId, sequelize) {
    try {
      this.logInfo('删除商品', { productId, merchantId });

      // 检查商品是否有关联数据（如订单）
      await this.checkProductDependencies(productId, sequelize);

      // 使用基础服务删除商品（软删除）
      const result = await this.deleteMerchantData(
        productId,
        merchantId,
        sequelize,
        this.productModelName,
        false // 软删除
      );

      this.logInfo('删除商品成功', { productId, merchantId });
      return result;

    } catch (error) {
      this.logError('删除商品失败', error, { productId, merchantId });
      throw error;
    }
  }

  /**
   * 批量更新商品状态
   * @param {Array} productIds - 商品ID数组
   * @param {number} status - 目标状态
   * @param {number} merchantId - 商户ID
   * @param {Object} sequelize - 数据库连接对象
   * @returns {Object} 批量更新结果
   */
  async batchUpdateStatus(productIds, status, merchantId, sequelize) {
    try {
      this.logInfo('批量更新商品状态', { 
        productIds: productIds.length, 
        status, 
        merchantId 
      });

      // 验证状态值
      if (![0, 1, 2].includes(status)) {
        throw new Error('商品状态值无效');
      }

      // 使用基础服务批量更新
      const result = await this.batchUpdateMerchantData(
        productIds,
        merchantId,
        { status },
        sequelize,
        this.productModelName
      );

      this.logInfo('批量更新商品状态成功', { 
        successCount: result.successCount,
        failedCount: result.failedIds.length,
        merchantId 
      });

      return {
        updatedCount: result.successCount,
        failedIds: result.failedIds
      };

    } catch (error) {
      this.logError('批量更新商品状态失败', error, { merchantId });
      throw error;
    }
  }

  /**
   * 验证店铺所有权
   * @param {number} merchantId - 商户ID
   * @param {number} shopId - 店铺ID
   * @param {Object} sequelize - 数据库连接对象
   */
  async validateShopOwnership(merchantId, shopId, sequelize) {
    try {
      const Shop = sequelize.models[this.shopModelName];
      if (!Shop) {
        return; // 如果没有店铺模型，跳过验证
      }

      const shop = await Shop.findOne({
        where: {
          id: shopId,
          merchantId: merchantId
        }
      });

      if (!shop) {
        throw new Error('店铺不存在或无权访问');
      }

    } catch (error) {
      throw error;
    }
  }

  /**
   * 验证商品数据
   * @param {Object} productData - 商品数据
   */
  validateProductData(productData) {
    const { name, price, stock, shopId, categoryId } = productData;

    if (!name || name.trim().length === 0) {
      throw new Error('商品名称不能为空');
    }

    if (name.length > 200) {
      throw new Error('商品名称不能超过200个字符');
    }

    if (!price || price <= 0) {
      throw new Error('商品价格必须大于0');
    }

    if (price > 999999.99) {
      throw new Error('商品价格不能超过999999.99');
    }

    if (stock === undefined || stock < 0) {
      throw new Error('商品库存不能为负数');
    }

    if (stock > 999999) {
      throw new Error('商品库存不能超过999999');
    }

    if (!shopId || shopId <= 0) {
      throw new Error('店铺ID无效');
    }

    if (!categoryId || categoryId <= 0) {
      throw new Error('分类ID无效');
    }

    // 验证图片数组
    if (productData.images && Array.isArray(productData.images)) {
      if (productData.images.length > 10) {
        throw new Error('商品图片不能超过10张');
      }
      
      productData.images.forEach((image, index) => {
        if (typeof image !== 'string' || image.trim().length === 0) {
          throw new Error(`第${index + 1}张图片URL无效`);
        }
      });
    }
  }

  /**
   * 验证商品更新数据
   * @param {Object} updateData - 更新数据
   */
  validateProductUpdateData(updateData) {
    if (updateData.name !== undefined) {
      if (!updateData.name || updateData.name.trim().length === 0) {
        throw new Error('商品名称不能为空');
      }
      if (updateData.name.length > 200) {
        throw new Error('商品名称不能超过200个字符');
      }
    }

    if (updateData.price !== undefined) {
      if (!updateData.price || updateData.price <= 0) {
        throw new Error('商品价格必须大于0');
      }
      if (updateData.price > 999999.99) {
        throw new Error('商品价格不能超过999999.99');
      }
    }

    if (updateData.originalPrice !== undefined) {
      if (updateData.originalPrice < 0) {
        throw new Error('商品原价不能为负数');
      }
      if (updateData.originalPrice > 999999.99) {
        throw new Error('商品原价不能超过999999.99');
      }
    }

    if (updateData.stock !== undefined) {
      if (updateData.stock < 0) {
        throw new Error('商品库存不能为负数');
      }
      if (updateData.stock > 999999) {
        throw new Error('商品库存不能超过999999');
      }
    }

    if (updateData.status !== undefined) {
      if (![0, 1, 2].includes(updateData.status)) {
        throw new Error('商品状态值无效');
      }
    }

    if (updateData.categoryId !== undefined) {
      if (!updateData.categoryId || updateData.categoryId <= 0) {
        throw new Error('分类ID无效');
      }
    }

    // 验证图片数组
    if (updateData.images !== undefined) {
      if (!Array.isArray(updateData.images)) {
        throw new Error('商品图片必须是数组格式');
      }
      
      if (updateData.images.length > 10) {
        throw new Error('商品图片不能超过10张');
      }
      
      updateData.images.forEach((image, index) => {
        if (typeof image !== 'string' || image.trim().length === 0) {
          throw new Error(`第${index + 1}张图片URL无效`);
        }
      });
    }
  }

  /**
   * 检查商品依赖关系
   * @param {number} productId - 商品ID
   * @param {Object} sequelize - 数据库连接对象
   */
  async checkProductDependencies(productId, sequelize) {
    try {
      // 检查是否有关联的订单
      const Order = sequelize.models.Order;
      if (Order) {
        const orderCount = await Order.count({
          where: {
            productId: productId,
            deletedAt: null
          }
        });

        if (orderCount > 0) {
          throw new Error('商品存在关联订单，无法删除');
        }
      }

      // 检查是否有关联的购物车
      const Cart = sequelize.models.Cart;
      if (Cart) {
        const cartCount = await Cart.count({
          where: {
            productId: productId,
            deletedAt: null
          }
        });

        if (cartCount > 0) {
          throw new Error('商品存在关联购物车记录，无法删除');
        }
      }

    } catch (error) {
      throw error;
    }
  }
}

// 导出商户商品服务类，供控制器使用
module.exports = MerchantProductService;
