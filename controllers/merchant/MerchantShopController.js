/**
 * 商户店铺控制器类
 * 功能：处理商户端店铺管理相关的HTTP请求，包括店铺的增删改查等
 * 继承：BaseMerchantController，获得商户端特有的功能和验证逻辑
 * 职责：验证请求参数、调用服务层、返回标准化响应、确保数据隔离
 */

// 引入商户端基础控制器类，提供商户端通用功能
const BaseMerchantController = require('../base/BaseMerchantController');
// 引入商户店铺服务类，处理具体的店铺管理业务逻辑
const MerchantShopService = require('../../services/merchant/MerchantShopService');

class MerchantShopController extends BaseMerchantController {
  /**
   * 构造函数：初始化商户店铺控制器
   * 调用父类构造函数并创建店铺服务实例
   */
  constructor() {
    // 调用父类构造函数，获得商户端基础功能
    super();
    // 创建商户店铺服务实例，用于处理业务逻辑
    this.merchantShopService = new MerchantShopService();
  }

  /**
   * 获取商户店铺列表
   * 路由：GET /api/merchant/shop
   * 功能：获取当前商户的所有店铺信息，支持分页和筛选
   */
  getShops = this.asyncHandler(async (req, res) => {
    try {
      const merchantId = this.getMerchantId(req);
      this.logMerchantAction('获取商户店铺列表', req, { merchantId });

      // 验证商户身份
      const authError = this.validateMerchantAuth(req);
      if (authError) {
        return this.sendMerchantError(res, authError.message, authError.status);
      }

      // 处理分页参数
      const pagination = this.handleMerchantPagination(req);
      
      // 处理筛选参数
      const { status } = req.query;
      const filters = {};
      if (status !== undefined) {
        filters.status = parseInt(status);
      }

      // 构建查询条件（包含商户数据隔离）
      const queryConditions = this.buildMerchantQuery(req, filters);

      // 调用服务层获取店铺列表
      const result = await this.merchantShopService.getShops(
        queryConditions,
        pagination,
        res.sequelize
      );

      // 返回成功响应
      return this.sendMerchantSuccess(res, '获取店铺列表成功', {
        shops: result.shops,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / pagination.limit)
        }
      });

    } catch (error) {
      this.logMerchantError('获取商户店铺列表失败', error, req);
      return this.sendMerchantError(res, '获取店铺列表失败', 500);
    }
  });

  /**
   * 获取店铺详情
   * 路由：GET /api/merchant/shop/:shopId
   * 功能：获取指定店铺的详细信息
   */
  getShopById = this.asyncHandler(async (req, res) => {
    try {
      const { shopId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('获取店铺详情', req, { merchantId, shopId });

      // 验证店铺访问权限
      const accessError = this.validateShopAccess(req, shopId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 调用服务层获取店铺详情
      const shop = await this.merchantShopService.getShopById(
        shopId,
        merchantId,
        res.sequelize
      );

      if (!shop) {
        return this.sendMerchantError(res, '店铺不存在', 404);
      }

      // 返回成功响应
      return this.sendMerchantSuccess(res, '获取店铺详情成功', {
        shop: shop
      });

    } catch (error) {
      this.logMerchantError('获取店铺详情失败', error, req);
      return this.sendMerchantError(res, '获取店铺详情失败', 500);
    }
  });

  /**
   * 创建新店铺
   * 路由：POST /api/merchant/shop
   * 功能：为当前商户创建新的店铺
   */
  createShop = this.asyncHandler(async (req, res) => {
    try {
      const merchantId = this.getMerchantId(req);
      this.logMerchantAction('创建店铺', req, { merchantId });

      // 验证商户身份
      const authError = this.validateMerchantAuth(req);
      if (authError) {
        return this.sendMerchantError(res, authError.message, authError.status);
      }

      // 从请求体中提取店铺信息
      const { name, description, address, phone } = req.body;

      // 验证必需参数
      const validationErrors = this.validateRequiredFields(req, ['name', 'address', 'phone']);
      if (validationErrors) {
        return this.sendMerchantError(res, '请求参数不完整', 400, validationErrors);
      }

      // 准备店铺数据
      const shopData = {
        name,
        description: description || '',
        address,
        phone,
        merchantId: merchantId,
        status: 1 // 默认启用状态
      };

      // 调用服务层创建店铺
      const shop = await this.merchantShopService.createShop(shopData, res.sequelize);

      // 返回成功响应，状态码201表示资源已创建
      return this.sendMerchantSuccess(res, '店铺创建成功', {
        shop: shop
      }, 201);

    } catch (error) {
      this.logMerchantError('创建店铺失败', error, req);
      
      if (error.message.includes('已存在')) {
        return this.sendMerchantError(res, error.message, 409);
      } else if (error.message.includes('验证失败')) {
        return this.sendMerchantError(res, error.message, 400);
      } else {
        return this.sendMerchantError(res, '店铺创建失败', 500);
      }
    }
  });

  /**
   * 更新店铺信息
   * 路由：PUT /api/merchant/shop/:shopId
   * 功能：更新指定店铺的信息
   */
  updateShop = this.asyncHandler(async (req, res) => {
    try {
      const { shopId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('更新店铺信息', req, { merchantId, shopId });

      // 验证店铺访问权限
      const accessError = this.validateShopAccess(req, shopId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 从请求体中提取更新数据
      const { name, description, address, phone, status } = req.body;

      // 准备更新数据（只包含提供的字段）
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (address !== undefined) updateData.address = address;
      if (phone !== undefined) updateData.phone = phone;
      if (status !== undefined) updateData.status = parseInt(status);

      // 检查是否有数据需要更新
      if (Object.keys(updateData).length === 0) {
        return this.sendMerchantError(res, '没有提供需要更新的数据', 400);
      }

      // 调用服务层更新店铺
      const updatedShop = await this.merchantShopService.updateShop(
        shopId,
        merchantId,
        updateData,
        res.sequelize
      );

      if (!updatedShop) {
        return this.sendMerchantError(res, '店铺不存在或更新失败', 404);
      }

      // 返回成功响应
      return this.sendMerchantSuccess(res, '店铺更新成功', {
        shop: updatedShop
      });

    } catch (error) {
      this.logMerchantError('更新店铺信息失败', error, req);
      
      if (error.message.includes('验证失败')) {
        return this.sendMerchantError(res, error.message, 400);
      } else {
        return this.sendMerchantError(res, '店铺更新失败', 500);
      }
    }
  });

  /**
   * 删除店铺
   * 路由：DELETE /api/merchant/shop/:shopId
   * 功能：删除指定的店铺（软删除）
   */
  deleteShop = this.asyncHandler(async (req, res) => {
    try {
      const { shopId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('删除店铺', req, { merchantId, shopId });

      // 验证店铺访问权限
      const accessError = this.validateShopAccess(req, shopId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 调用服务层删除店铺
      const result = await this.merchantShopService.deleteShop(
        shopId,
        merchantId,
        res.sequelize
      );

      if (!result) {
        return this.sendMerchantError(res, '店铺不存在或删除失败', 404);
      }

      // 返回成功响应
      return this.sendMerchantSuccess(res, '店铺删除成功');

    } catch (error) {
      this.logMerchantError('删除店铺失败', error, req);
      
      if (error.message.includes('存在关联数据')) {
        return this.sendMerchantError(res, '店铺存在关联数据，无法删除', 409);
      } else {
        return this.sendMerchantError(res, '店铺删除失败', 500);
      }
    }
  });

  /**
   * 获取店铺统计信息
   * 路由：GET /api/merchant/shop/:shopId/stats
   * 功能：获取指定店铺的统计信息
   */
  getShopStats = this.asyncHandler(async (req, res) => {
    try {
      const { shopId } = req.params;
      const merchantId = this.getMerchantId(req);
      
      this.logMerchantAction('获取店铺统计信息', req, { merchantId, shopId });

      // 验证店铺访问权限
      const accessError = this.validateShopAccess(req, shopId);
      if (accessError) {
        return this.sendMerchantError(res, accessError.message, accessError.status);
      }

      // 调用服务层获取店铺统计信息
      const stats = await this.merchantShopService.getShopStats(
        shopId,
        merchantId,
        res.sequelize
      );

      // 返回成功响应
      return this.sendMerchantSuccess(res, '获取店铺统计信息成功', {
        stats: stats
      });

    } catch (error) {
      this.logMerchantError('获取店铺统计信息失败', error, req);
      return this.sendMerchantError(res, '获取店铺统计信息失败', 500);
    }
  });
}

// 导出商户店铺控制器类，供路由模块使用
module.exports = MerchantShopController;
