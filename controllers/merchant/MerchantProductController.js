/**
 * 商户商品控制器类
 * 功能：处理商户端商品管理相关的HTTP请求，包括商品的增删改查等
 * 继承：BaseMerchantController，获得商户端特有的功能和验证逻辑
 * 职责：验证请求参数、调用服务层、返回标准化响应、确保数据隔离
 */

// 引入商户端基础控制器类，提供商户端通用功能
const BaseMerchantController = require('../base/BaseMerchantController');
// 引入商户商品服务类，处理具体的商品管理业务逻辑
const MerchantProductService = require('../../services/merchant/MerchantProductService');

class MerchantProductController extends BaseMerchantController {
  /**
   * 构造函数：初始化商户商品控制器
   * 调用父类构造函数并创建商品服务实例
   */
  constructor() {
    // 调用父类构造函数，获得商户端基础功能
    super();
    // 创建商户商品服务实例，用于处理业务逻辑
    this.merchantProductService = new MerchantProductService();
  }

  /**
   * 获取商户商品列表
   * 路由：GET /api/merchant/products
   * 功能：获取当前商户的所有商品信息，支持分页、筛选和搜索
   */
  getProducts = this.asyncHandler(async (req, res) => {
    try {
      const merchantId = this.getMerchantId(req);
      this.logMerchantAction('获取商户商品列表', req, { merchantId });

      // 验证商户身份
      const authError = this.validateMerchantAuth(req);
      if (authError) {
        return this.sendMerchantError(res, authError.message, authError.status);
      }

      // 处理分页参数
      const pagination = this.handleMerchantPagination(req);
      
      // 处理筛选和搜索参数
      const { shopId, categoryId, status, keyword } = req.query;
      const filters = {};
      
      if (shopId !== undefined) {
        // 验证店铺访问权限
        const shopAccessError = this.validateShopAccess(req, shopId);
        if (shopAccessError) {
          return this.sendMerchantError(res, shopAccessError.message, shopAccessError.status);
        }
        filters.shopId = parseInt(shopId);
      }
      
      if (categoryId !== undefined) filters.categoryId = parseInt(categoryId);
      if (status !== undefined) filters.status = parseInt(status);
      if (keyword) filters.keyword = keyword.trim();

      // 构建查询条件（包含商户数据隔离）
      const queryConditions = this.buildMerchantQuery(req, filters);

      // 调用服务层获取商品列表
      const result = await this.merchantProductService.getProducts(
        queryConditions,
        pagination,
        res.sequelize
      );

      // 返回成功响应
      return this.sendMerchantSuccess(res, '获取商品列表成功', {
        products: result.products,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / pagination.limit)
        }
      });

    } catch (error) {
      this.logMerchantError('获取商户商品列表失败', error, req);
      return this.sendMerchantError(res, '获取商品列表失败', 500);
    }
  });

  /**
   * 获取商品详情
   * 路由：GET /api/merchant/products/:productId
   * 功能：获取指定商品的详细信息
   */
  getProductById = this.asyncHandler(async (req, res) => {
    try {
      const { productId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('获取商品详情', req, { merchantId, productId });

      // 验证商品访问权限
      const accessError = this.validateProductAccess(req, productId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 调用服务层获取商品详情
      const product = await this.merchantProductService.getProductById(
        productId,
        merchantId,
        res.sequelize
      );

      if (!product) {
        return this.sendMerchantError(res, '商品不存在', 404);
      }

      // 返回成功响应
      return this.sendMerchantSuccess(res, '获取商品详情成功', {
        product: product
      });

    } catch (error) {
      this.logMerchantError('获取商品详情失败', error, req);
      return this.sendMerchantError(res, '获取商品详情失败', 500);
    }
  });

  /**
   * 创建新商品
   * 路由：POST /api/merchant/products
   * 功能：为当前商户创建新的商品
   */
  createProduct = this.asyncHandler(async (req, res) => {
    try {
      const merchantId = this.getMerchantId(req);
      this.logMerchantAction('创建商品', req, { merchantId });

      // 验证商户身份
      const authError = this.validateMerchantAuth(req);
      if (authError) {
        return this.sendMerchantError(res, authError.message, authError.status);
      }

      // 从请求体中提取商品信息
      const { 
        name, description, price, originalPrice, stock, 
        shopId, categoryId, images 
      } = req.body;

      // 验证必需参数
      const validationErrors = this.validateRequiredFields(req, [
        'name', 'price', 'stock', 'shopId', 'categoryId'
      ]);
      if (validationErrors) {
        return this.sendMerchantError(res, '请求参数不完整', 400, validationErrors);
      }

      // 验证店铺访问权限
      const shopAccessError = this.validateShopAccess(req, shopId);
      if (shopAccessError) {
        return this.sendMerchantError(res, shopAccessError.message, shopAccessError.status);
      }

      // 验证价格和库存
      if (price <= 0) {
        return this.sendMerchantError(res, '商品价格必须大于0', 400);
      }
      if (stock < 0) {
        return this.sendMerchantError(res, '商品库存不能为负数', 400);
      }

      // 准备商品数据
      const productData = {
        name,
        description: description || '',
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
        stock: parseInt(stock),
        shopId: parseInt(shopId),
        categoryId: parseInt(categoryId),
        merchantId: merchantId,
        status: 1, // 默认上架状态
        images: images || []
      };

      // 调用服务层创建商品
      const product = await this.merchantProductService.createProduct(productData, res.sequelize);

      // 返回成功响应，状态码201表示资源已创建
      return this.sendMerchantSuccess(res, '商品创建成功', {
        product: product
      }, 201);

    } catch (error) {
      this.logMerchantError('创建商品失败', error, req);
      
      if (error.message.includes('已存在')) {
        return this.sendMerchantError(res, error.message, 409);
      } else if (error.message.includes('验证失败')) {
        return this.sendMerchantError(res, error.message, 400);
      } else {
        return this.sendMerchantError(res, '商品创建失败', 500);
      }
    }
  });

  /**
   * 更新商品信息
   * 路由：PUT /api/merchant/products/:productId
   * 功能：更新指定商品的信息
   */
  updateProduct = this.asyncHandler(async (req, res) => {
    try {
      const { productId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('更新商品信息', req, { merchantId, productId });

      // 验证商品访问权限
      const accessError = this.validateProductAccess(req, productId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 从请求体中提取更新数据
      const { 
        name, description, price, originalPrice, stock, 
        status, categoryId, images 
      } = req.body;

      // 准备更新数据（只包含提供的字段）
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) {
        const parsedPrice = parseFloat(price);
        if (parsedPrice <= 0) {
          return this.sendMerchantError(res, '商品价格必须大于0', 400);
        }
        updateData.price = parsedPrice;
      }
      if (originalPrice !== undefined) updateData.originalPrice = parseFloat(originalPrice);
      if (stock !== undefined) {
        const parsedStock = parseInt(stock);
        if (parsedStock < 0) {
          return this.sendMerchantError(res, '商品库存不能为负数', 400);
        }
        updateData.stock = parsedStock;
      }
      if (status !== undefined) updateData.status = parseInt(status);
      if (categoryId !== undefined) updateData.categoryId = parseInt(categoryId);
      if (images !== undefined) updateData.images = images;

      // 检查是否有数据需要更新
      if (Object.keys(updateData).length === 0) {
        return this.sendMerchantError(res, '没有提供需要更新的数据', 400);
      }

      // 调用服务层更新商品
      const updatedProduct = await this.merchantProductService.updateProduct(
        productId,
        merchantId,
        updateData,
        res.sequelize
      );

      if (!updatedProduct) {
        return this.sendMerchantError(res, '商品不存在或更新失败', 404);
      }

      // 返回成功响应
      return this.sendMerchantSuccess(res, '商品更新成功', {
        product: updatedProduct
      });

    } catch (error) {
      this.logMerchantError('更新商品信息失败', error, req);
      
      if (error.message.includes('验证失败')) {
        return this.sendMerchantError(res, error.message, 400);
      } else {
        return this.sendMerchantError(res, '商品更新失败', 500);
      }
    }
  });

  /**
   * 删除商品
   * 路由：DELETE /api/merchant/products/:productId
   * 功能：删除指定的商品（软删除）
   */
  deleteProduct = this.asyncHandler(async (req, res) => {
    try {
      const { productId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('删除商品', req, { merchantId, productId });

      // 验证商品访问权限
      const accessError = this.validateProductAccess(req, productId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 调用服务层删除商品
      const result = await this.merchantProductService.deleteProduct(
        productId,
        merchantId,
        res.sequelize
      );

      if (!result) {
        return this.sendMerchantError(res, '商品不存在或删除失败', 404);
      }

      // 返回成功响应
      return this.sendMerchantSuccess(res, '商品删除成功');

    } catch (error) {
      this.logMerchantError('删除商品失败', error, req);
      
      if (error.message.includes('存在关联数据')) {
        return this.sendMerchantError(res, '商品存在关联数据，无法删除', 409);
      } else {
        return this.sendMerchantError(res, '商品删除失败', 500);
      }
    }
  });

  /**
   * 批量更新商品状态
   * 路由：PUT /api/merchant/products/batch
   * 功能：批量更新多个商品的状态
   */
  batchUpdateStatus = this.asyncHandler(async (req, res) => {
    try {
      const merchantId = this.getMerchantId(req);
      this.logMerchantAction('批量更新商品状态', req, { merchantId });

      // 验证商户身份
      const authError = this.validateMerchantAuth(req);
      if (authError) {
        return this.sendMerchantError(res, authError.message, authError.status);
      }

      // 从请求体中提取批量更新数据
      const { productIds, status } = req.body;

      // 验证必需参数
      const validationErrors = this.validateRequiredFields(req, ['productIds', 'status']);
      if (validationErrors) {
        return this.sendMerchantError(res, '请求参数不完整', 400, validationErrors);
      }

      // 验证商品ID数组
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return this.sendMerchantError(res, '商品ID列表不能为空', 400);
      }

      // 验证状态值
      const parsedStatus = parseInt(status);
      if (![0, 1, 2].includes(parsedStatus)) {
        return this.sendMerchantError(res, '商品状态值无效', 400);
      }

      // 调用服务层批量更新商品状态
      const result = await this.merchantProductService.batchUpdateStatus(
        productIds,
        parsedStatus,
        merchantId,
        res.sequelize
      );

      // 返回成功响应
      return this.sendMerchantSuccess(res, '批量更新商品状态成功', {
        updatedCount: result.updatedCount,
        failedIds: result.failedIds || []
      });

    } catch (error) {
      this.logMerchantError('批量更新商品状态失败', error, req);
      return this.sendMerchantError(res, '批量更新商品状态失败', 500);
    }
  });
}

// 导出商户商品控制器类，供路由模块使用
module.exports = MerchantProductController;
