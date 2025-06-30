/**
 * 用户认证控制器类
 * 功能：处理用户端认证相关的HTTP请求，包括登录、注册、令牌管理等
 * 继承：BaseController，获得统一的响应格式和错误处理能力
 * 职责：验证请求参数、调用服务层、返回标准化响应
 */

// 引入基础控制器类，提供通用的控制器功能
const BaseController = require('../base/BaseController');
// 引入用户认证服务类，处理具体的认证业务逻辑
const UserAuthService = require('../../services/user/UserAuthService');
const { COMMON_STATUS } = require('../../common/constants/status');

class UserAuthController extends BaseController {
  /**
   * 构造函数：初始化用户认证控制器
   * 调用父类构造函数并创建认证服务实例
   */
  constructor() {
    // 调用父类构造函数，获得基础功能
    super();
    // 创建用户认证服务实例，用于处理业务逻辑
    this.userAuthService = new UserAuthService();
  }

  /**
   * 用户登录方法
   * 路由：POST /api/user/auth/login
   * 功能：验证用户凭据，生成访问令牌和刷新令牌
   */
  login = this.asyncHandler(async (req, res) => {
    try {
      // 记录登录请求操作日志
      this.logAction('用户登录请求', req);

      // 从请求体中提取用户名和密码
      const { username, password } = req.body;

      // 验证必需参数是否存在
      const validationErrors = this.validateRequiredFields(req, ['username', 'password']);
      if (validationErrors) {
        return this.sendError(res, '请求参数不完整', 400, validationErrors);
      }

      // 调用服务层处理登录逻辑，传入数据库连接
      const result = await this.userAuthService.login(username, password, res.sequelize);

      // 返回成功响应，包含用户信息和令牌
      return this.sendSuccess(res, '登录成功', {
        user: result.user,                      // 用户基本信息
        token: result.tokens.accessToken,      // 访问令牌
        refreshToken: result.tokens.refreshToken,  // 刷新令牌
        expiresIn: result.tokens.expiresIn     // 令牌过期时间
      });

    } catch (error) {
      // 记录登录失败的错误日志
      this.logError('用户登录失败', error, req);

      // 根据不同的错误类型返回相应的HTTP状态码和错误消息
      if (error.message.includes('用户不存在') || error.message.includes('密码错误')) {
        return this.sendError(res, '用户名或密码错误', 401);
      } else if (error.message.includes('状态异常')) {
        return this.sendError(res, '账户状态异常，请联系管理员', 403);
      } else if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '登录失败，请稍后重试', 500);
      }
    }
  });

  /**
   * 用户注册方法
   * 路由：POST /api/user/auth/register
   * 功能：创建新用户账户，验证输入数据，生成初始令牌
   */
  register = this.asyncHandler(async (req, res) => {
    try {
      // 记录注册请求操作日志
      this.logAction('用户注册请求', req);

      // 从请求体中提取注册信息
      const { username, email, password, confirmPassword } = req.body;

      // 验证所有必需参数是否存在
      const validationErrors = this.validateRequiredFields(req, ['username', 'email', 'password', 'confirmPassword']);
      if (validationErrors) {
        return this.sendError(res, '请求参数不完整', 400, validationErrors);
      }

      // 验证密码确认是否一致
      if (password !== confirmPassword) {
        return this.sendError(res, '两次输入的密码不一致', 400);
      }

      // 调用服务层处理用户注册逻辑
      const result = await this.userAuthService.register({
        username,  // 用户名
        email,     // 邮箱地址
        password   // 密码（将在服务层进行加密）
      }, res.sequelize);

      // 返回成功响应，状态码201表示资源已创建
      return this.sendSuccess(res, '注册成功', {
        user: result.user,                      // 新创建的用户信息
        token: result.tokens.accessToken,      // 访问令牌
        refreshToken: result.tokens.refreshToken,  // 刷新令牌
        expiresIn: result.tokens.expiresIn     // 令牌过期时间
      }, 201);

    } catch (error) {
      // 记录注册失败的错误日志
      this.logError('用户注册失败', error, req);

      // 根据不同的错误类型返回相应的HTTP状态码和错误消息
      if (error.message.includes('已存在') || error.message.includes('已被注册')) {
        return this.sendError(res, error.message, 409);  // 409 Conflict - 资源冲突
      } else if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);  // 400 Bad Request - 请求参数错误
      } else {
        return this.sendError(res, '注册失败，请稍后重试', 500);  // 500 Internal Server Error - 服务器内部错误
      }
    }
  });

  /**
   * 刷新令牌
   * POST /api/user/auth/refresh
   */
  refreshToken = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('令牌刷新请求', req);

      const { refreshToken } = req.body;

      // 验证必需参数
      if (!refreshToken) {
        return this.sendError(res, '刷新令牌不能为空', 400);
      }

      // 调用服务层处理令牌刷新
      const tokens = await this.userAuthService.refreshToken(refreshToken, res.sequelize);

      // 返回成功响应
      return this.sendSuccess(res, '令牌刷新成功', {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      });

    } catch (error) {
      this.logError('令牌刷新失败', error, req);
      
      if (error.message.includes('无效') || error.message.includes('过期')) {
        return this.sendError(res, '刷新令牌无效或已过期', 401);
      } else {
        return this.sendError(res, '令牌刷新失败', 500);
      }
    }
  });

  /**
   * 用户登出
   * POST /api/user/auth/logout
   */
  logout = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('用户登出请求', req, { userId: req.user?.id });

      // 获取当前用户的令牌
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return this.sendError(res, '未找到访问令牌', 400);
      }

      // 调用服务层处理登出
      await this.userAuthService.logout(token);

      // 返回成功响应
      return this.sendSuccess(res, '登出成功');

    } catch (error) {
      this.logError('用户登出失败', error, req);
      return this.sendError(res, '登出失败', 500);
    }
  });

  /**
   * 获取当前用户信息
   * GET /api/user/auth/me
   */
  getCurrentUser = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取当前用户信息', req, { userId: req.user?.id });

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      // 返回当前用户信息（已经在中间件中处理了敏感信息）
      return this.sendSuccess(res, '获取用户信息成功', {
        user: req.user
      });

    } catch (error) {
      this.logError('获取当前用户信息失败', error, req);
      return this.sendError(res, '获取用户信息失败', 500);
    }
  });

  /**
   * 修改密码
   * PUT /api/user/auth/password
   */
  changePassword = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('修改密码请求', req, { userId: req.user?.id });

      const { currentPassword, newPassword, confirmPassword } = req.body;

      // 验证必需参数
      const validationErrors = this.validateRequiredFields(req, ['currentPassword', 'newPassword', 'confirmPassword']);
      if (validationErrors) {
        return this.sendError(res, '请求参数不完整', 400, validationErrors);
      }

      // 验证新密码确认
      if (newPassword !== confirmPassword) {
        return this.sendError(res, '两次输入的新密码不一致', 400);
      }

      // 检查用户是否已认证
      if (!req.user) {
        return this.sendError(res, '用户未认证', 401);
      }

      // 调用服务层处理密码修改
      await this.userAuthService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        res.sequelize
      );

      // 返回成功响应
      return this.sendSuccess(res, '密码修改成功');

    } catch (error) {
      this.logError('修改密码失败', error, req);
      
      if (error.message.includes('当前密码错误')) {
        return this.sendError(res, '当前密码错误', 400);
      } else if (error.message.includes('验证失败')) {
        return this.sendError(res, error.message, 400);
      } else {
        return this.sendError(res, '密码修改失败', 500);
      }
    }
  });

  /**
   * 验证令牌有效性
   * GET /api/user/auth/verify
   */
  verifyToken = this.asyncHandler(async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return this.sendError(res, '未提供访问令牌', 400);
      }

      // 调用服务层验证令牌
      const decoded = await this.userAuthService.verifyToken(token);

      return this.sendSuccess(res, '令牌有效', {
        valid: COMMON_STATUS.SUCCESS,
        user: {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email
        },
        expiresAt: new Date(decoded.exp * 1000)
      });

    } catch (error) {
      this.logError('令牌验证失败', error, req);
      return this.sendError(res, '令牌无效或已过期', 401);
    }
  });
}

// 导出用户认证控制器类，供路由模块使用
module.exports = UserAuthController;
