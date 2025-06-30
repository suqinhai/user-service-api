/**
 * 核心验证中间件
 * 提供基于express-validator的请求参数验证功能，支持多种验证规则和自定义验证
 */

const { validationResult, body, query, param, header } = require('express-validator');
const { getI18n } = require('../../common/i18n');
const { logger } = require('../../common/logger');
const { COMMON_STATUS } = require('../../common/constants/status');

/**
 * 处理验证结果的中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
const handleValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    const i18n = getI18n();
    
    // 记录验证错误
    logger.warn('参数验证失败', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.sendBadRequest(i18n.t(firstError.msg) || i18n.t('参数验证失败'), {
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: i18n.t(err.msg) || i18n.t('验证失败'),
        value: err.value,
        location: err.location
      }))
    });
  }
  next();
};

/**
 * 通用字段验证规则
 */
const rules = {
  // 用户相关验证
  username: () => body('username')
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 4, max: 20 }).withMessage('用户名长度应为4-20个字符')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
  
  password: () => body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 6, max: 20 }).withMessage('密码长度应为6-20个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('密码必须包含大小写字母和数字'),
  
  email: () => body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  phone: () => body('phone')
    .optional({ checkFalsy: true })
    .matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  
  // 参数验证
  id: () => param('id')
    .isInt({ min: 1 }).withMessage('ID必须是正整数'),
  
  uuid: () => param('id')
    .isUUID().withMessage('ID必须是有效的UUID格式'),
  
  // 分页验证
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('页码必须是正整数')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
      .toInt(),
    query('sort')
      .optional()
      .matches(/^[a-zA-Z_]+:(asc|desc)$/).withMessage('排序格式不正确，应为field:asc或field:desc')
  ],
  
  // 搜索验证
  search: () => [
    query('keyword')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }).withMessage('搜索关键词长度应为1-50个字符'),
    query('category')
      .optional()
      .isIn(['all', 'user', 'admin', 'content']).withMessage('搜索分类不正确')
  ],
  
  // 日期验证
  dateRange: () => [
    query('startDate')
      .optional()
      .isISO8601().withMessage('开始日期格式不正确')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601().withMessage('结束日期格式不正确')
      .toDate()
      .custom((value, { req }) => {
        if (req.query.startDate && value < new Date(req.query.startDate)) {
          throw new Error('结束日期不能早于开始日期');
        }
        return true;
      })
  ],
  
  // 状态验证
  status: () => body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'deleted']).withMessage('状态值不正确'),
  
  // 角色验证
  role: () => body('role')
    .optional()
    .isIn(['user', 'admin', 'super_admin']).withMessage('角色值不正确'),
  
  // 文件上传验证
  file: () => body('file')
    .custom((value, { req }) => {
      if (!req.file && !req.files) {
        throw new Error('请选择要上传的文件');
      }
      return true;
    }),
  
  // JSON验证
  jsonData: () => body('data')
    .isJSON().withMessage('数据格式必须是有效的JSON')
    .customSanitizer(value => {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }),
  
  // 数组验证
  arrayField: (fieldName, itemValidator) => body(fieldName)
    .isArray().withMessage(`${fieldName}必须是数组`)
    .custom((value) => {
      if (itemValidator) {
        return value.every(itemValidator);
      }
      return true;
    }),
  
  // 自定义验证规则
  custom: (fieldName, validator, location = 'body') => {
    const validatorMap = { body, query, param, header };
    return validatorMap[location](fieldName).custom(validator);
  }
};

/**
 * 构建验证器
 * @param {Array} validations - 验证规则数组
 * @returns {Array} - 中间件数组
 */
const validate = (validations) => {
  return [...validations, handleValidationResult];
};

/**
 * 创建条件验证器
 * @param {Function} condition - 条件函数
 * @param {Array} validations - 验证规则数组
 * @returns {Function} - 中间件函数
 */
const conditionalValidate = (condition, validations) => {
  return (req, res, next) => {
    if (condition(req)) {
      return validate(validations)(req, res, next);
    }
    next();
  };
};

/**
 * 创建组合验证器
 * @param {Object} validationGroups - 验证组对象
 * @returns {Function} - 中间件函数
 */
const createGroupValidator = (validationGroups) => {
  return (req, res, next) => {
    const validations = [];
    
    Object.entries(validationGroups).forEach(([groupName, groupValidations]) => {
      if (req.body[groupName] !== undefined || req.query[groupName] !== undefined) {
        validations.push(...groupValidations);
      }
    });
    
    if (validations.length > 0) {
      return validate(validations)(req, res, next);
    }
    
    next();
  };
};

/**
 * 异步验证器
 * @param {Function} asyncValidator - 异步验证函数
 * @returns {Function} - 验证函数
 */
const asyncValidator = (asyncValidator) => {
  return async (value, { req }) => {
    try {
      const result = await asyncValidator(value, req);
      if (!result) {
        throw new Error('验证失败');
      }
      return true;
    } catch (error) {
      throw new Error(error.message || '异步验证失败');
    }
  };
};

/**
 * 常用验证组合
 */
const commonValidations = {
  // 登录验证
  login: validate([
    rules.username(),
    rules.password()
  ]),
  
  // 注册验证
  register: validate([
    rules.username(),
    rules.password(),
    rules.email()
  ]),
  
  // 用户更新验证
  updateUser: validate([
    rules.id(),
    body('username').optional().trim().isLength({ min: 4, max: 20 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^1[3-9]\d{9}$/),
    rules.status()
  ]),
  
  // 分页查询验证
  paginatedQuery: validate([
    ...rules.pagination(),
    ...rules.search()
  ]),
  
  // 日期范围查询验证
  dateRangeQuery: validate([
    ...rules.dateRange(),
    ...rules.pagination()
  ])
};

module.exports = {
  validate,
  conditionalValidate,
  createGroupValidator,
  asyncValidator,
  rules,
  commonValidations,
  handleValidationResult
};
