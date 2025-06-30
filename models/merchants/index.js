/**
 * 商户端数据模型索引文件
 * 功能：导出商户端相关的数据模型定义和配置
 * 说明：商户端主要复用现有的User模型，通过userType字段区分商户用户
 *       如果需要独立的商户模型，可以在此文件中定义
 */

/**
 * 商户用户扩展字段说明
 * 
 * 在现有User模型基础上，商户用户应包含以下字段：
 * - userType: 'merchant' (用户类型标识)
 * - merchantId: number (商户ID，唯一标识)
 * - businessName: string (商户名称/企业名称)
 * - businessType: string (商户类型：个人/企业/其他)
 * - merchantStatus: number (商户状态：0-禁用，1-正常，2-审核中)
 * - shopIds: array (商户拥有的店铺ID列表)
 * - contactPerson: string (联系人姓名)
 * - contactPhone: string (联系电话)
 * - businessLicense: string (营业执照号码)
 * - taxNumber: string (税务登记号)
 * - bankAccount: string (银行账户信息)
 * - address: string (商户地址)
 * - description: string (商户描述)
 * - avatar: string (商户头像/Logo)
 * - verifiedAt: date (认证时间)
 * - lastLoginAt: date (最后登录时间)
 * - lastLoginIp: string (最后登录IP)
 */

/**
 * 店铺模型字段说明
 * 
 * Shop模型应包含以下字段：
 * - id: number (店铺ID，主键)
 * - name: string (店铺名称)
 * - description: string (店铺描述)
 * - address: string (店铺地址)
 * - phone: string (联系电话)
 * - email: string (联系邮箱)
 * - status: number (店铺状态：0-禁用，1-启用)
 * - merchantId: number (所属商户ID，外键)
 * - logo: string (店铺Logo)
 * - banner: string (店铺横幅)
 * - businessHours: json (营业时间)
 * - coordinates: json (地理坐标)
 * - rating: decimal (店铺评分)
 * - reviewCount: number (评价数量)
 * - createdAt: date (创建时间)
 * - updatedAt: date (更新时间)
 * - deletedAt: date (删除时间，软删除)
 */

/**
 * 商品模型字段说明
 * 
 * Product模型应包含以下字段：
 * - id: number (商品ID，主键)
 * - name: string (商品名称)
 * - description: text (商品描述)
 * - price: decimal (商品价格)
 * - originalPrice: decimal (原价)
 * - stock: number (库存数量)
 * - status: number (商品状态：0-下架，1-上架，2-缺货)
 * - categoryId: number (分类ID)
 * - shopId: number (所属店铺ID，外键)
 * - merchantId: number (所属商户ID，外键)
 * - sku: string (商品SKU)
 * - barcode: string (商品条码)
 * - weight: decimal (商品重量)
 * - dimensions: json (商品尺寸)
 * - images: json (商品图片列表)
 * - attributes: json (商品属性)
 * - tags: json (商品标签)
 * - saleCount: number (销售数量)
 * - viewCount: number (浏览次数)
 * - rating: decimal (商品评分)
 * - reviewCount: number (评价数量)
 * - createdAt: date (创建时间)
 * - updatedAt: date (更新时间)
 * - deletedAt: date (删除时间，软删除)
 */

/**
 * 商户端模型关系说明
 * 
 * 1. User (商户用户) 1:N Shop (店铺)
 *    - 一个商户可以拥有多个店铺
 *    - 通过merchantId关联
 * 
 * 2. Shop (店铺) 1:N Product (商品)
 *    - 一个店铺可以有多个商品
 *    - 通过shopId关联
 * 
 * 3. User (商户用户) 1:N Product (商品)
 *    - 一个商户可以有多个商品（跨店铺）
 *    - 通过merchantId关联
 * 
 * 4. Product (商品) N:1 Category (分类)
 *    - 多个商品属于一个分类
 *    - 通过categoryId关联
 */

/**
 * 数据库索引建议
 * 
 * User表索引：
 * - idx_user_merchant_id (merchantId)
 * - idx_user_type_status (userType, status)
 * - idx_user_merchant_status (merchantStatus)
 * 
 * Shop表索引：
 * - idx_shop_merchant_id (merchantId)
 * - idx_shop_status (status)
 * - idx_shop_created_at (createdAt)
 * 
 * Product表索引：
 * - idx_product_merchant_id (merchantId)
 * - idx_product_shop_id (shopId)
 * - idx_product_category_id (categoryId)
 * - idx_product_status (status)
 * - idx_product_created_at (createdAt)
 * - idx_product_name (name) - 用于搜索
 */

/**
 * 商户端权限控制说明
 * 
 * 1. 数据隔离原则：
 *    - 商户只能访问自己的数据
 *    - 通过merchantId进行数据过滤
 *    - 所有查询都必须包含merchantId条件
 * 
 * 2. 店铺权限控制：
 *    - 商户只能管理自己的店铺
 *    - 通过shopIds数组控制店铺访问权限
 *    - 跨店铺操作需要验证权限
 * 
 * 3. 商品权限控制：
 *    - 商户只能管理自己店铺的商品
 *    - 通过shopId和merchantId双重验证
 *    - 批量操作需要逐一验证权限
 */

/**
 * 商户端缓存策略说明
 * 
 * 1. 商户信息缓存：
 *    - 缓存时间：30分钟
 *    - 缓存键：merchant_info_{merchantId}
 *    - 更新策略：商户信息变更时清除
 * 
 * 2. 店铺列表缓存：
 *    - 缓存时间：10分钟
 *    - 缓存键：merchant_shops_{merchantId}
 *    - 更新策略：店铺增删改时清除
 * 
 * 3. 商品列表缓存：
 *    - 缓存时间：5分钟
 *    - 缓存键：merchant_products_{merchantId}_{page}_{filters}
 *    - 更新策略：商品变更时清除相关缓存
 */

/**
 * 导出商户端模型配置
 * 注意：实际的模型定义应该在对应的模型文件中
 * 这里主要提供配置和说明信息
 */
module.exports = {
  // 商户端模型名称映射
  models: {
    User: 'User',           // 商户用户（复用现有User模型）
    Shop: 'Shop',           // 店铺模型
    Product: 'Product',     // 商品模型
    Category: 'Category'    // 分类模型（如果需要）
  },

  // 商户端字段配置
  fields: {
    merchant: {
      userType: 'merchant',
      requiredFields: ['username', 'email', 'password', 'businessName'],
      optionalFields: ['businessType', 'contactPerson', 'contactPhone', 'address']
    },
    shop: {
      requiredFields: ['name', 'address', 'phone', 'merchantId'],
      optionalFields: ['description', 'email', 'logo', 'banner']
    },
    product: {
      requiredFields: ['name', 'price', 'stock', 'shopId', 'merchantId', 'categoryId'],
      optionalFields: ['description', 'originalPrice', 'sku', 'images', 'attributes']
    }
  },

  // 商户端状态枚举（已迁移到统一常量文件）
  // 请使用 require('../../common/constants/status') 中的常量
  status: {
    merchant: {
      DISABLED: 0,    // 禁用
      ACTIVE: 1,      // 正常
      PENDING: 2,     // 审核中
      REJECTED: 3,    // 审核拒绝
      SUSPENDED: 4    // 暂停营业
    },
    shop: {
      DISABLED: 0,    // 禁用
      ACTIVE: 1,      // 启用
      MAINTENANCE: 2, // 维护中
      CLOSED: 3       // 已关闭
    },
    product: {
      OFFLINE: 0,     // 下架
      ONLINE: 1,      // 上架
      OUT_OF_STOCK: 2,// 缺货
      DISCONTINUED: 3 // 停产
    }
  },

  // 商户端限制配置
  limits: {
    maxShopsPerMerchant: 10,      // 每个商户最多店铺数
    maxProductsPerShop: 1000,     // 每个店铺最多商品数
    maxImagesPerProduct: 10,      // 每个商品最多图片数
    maxNameLength: 200,           // 名称最大长度
    maxDescriptionLength: 2000    // 描述最大长度
  },

  // 商户端验证规则
  validation: {
    phone: /^1[3-9]\d{9}$/,                    // 手机号格式
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,       // 邮箱格式
    businessLicense: /^[0-9A-Z]{15,20}$/,      // 营业执照号格式
    price: { min: 0.01, max: 999999.99 },     // 价格范围
    stock: { min: 0, max: 999999 }            // 库存范围
  }
};
