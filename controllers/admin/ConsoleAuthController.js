/**
 * 总台认证控制器
 * 处理总台管理员认证相关的HTTP请求
 */

const BaseController = require('../base/BaseController');
const ConsoleAuthService = require('../../services/admin/ConsoleAuthService');

class ConsoleAuthController extends BaseController {
  constructor() {
    super();
    this.consoleAuthService = new ConsoleAuthService();
  }

  /**
   * 总台管理员登录
   * POST /api/admin/console/auth/login
   */
  login = this.asyncHandler(async (req, res) => {
    try {
      
      const { username, password } = req.body;

      // 验证必需参数
      if (!username || !password) {
        return this.sendError(res, '用户名和密码不能为空', 400);
      }

      // 获取客户端IP
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

      // 调用服务层处理登录逻辑
      const result = await this.consoleAuthService.login(
        username.trim(),
        password,
        clientIP,
        res.sequelize
      );

      // 返回成功响应
      return this.sendSuccess(res, '登录成功', {
        ...result.user,
        token: result.tokens.accessToken,
      });

    } catch (error) {
      this.logError('总台登录失败', error, req);
      
      // 根据错误类型返回不同的状态码
      if (error.message.includes('锁定') || error.message.includes('尝试机会')) {
        return this.sendError(res, error.message, 423); // 423 Locked
      } else if (error.message.includes('不存在') || error.message.includes('密码') || error.message.includes('状态异常')) {
        return this.sendError(res, error.message, 401); // 401 Unauthorized
      } else {
        return this.sendError(res, '总台登录失败，请稍后重试', 500);
      }
    }
  });

  /**
   * 总台管理员登出
   * POST /api/admin/console/auth/logout
   */
  logout = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('总台登出请求', req);

      const token = req.headers.authorization?.split(' ')[1];
      const user = req.user; // 来自认证中间件

      if (!token) {
        return this.sendError(res, '未提供访问令牌', 400);
      }

      // 调用服务层处理登出逻辑
      const result = await this.consoleAuthService.logout(token, user);

      return this.sendSuccess(res, result.message, {
        logoutTime: result.logoutTime
      });

    } catch (error) {
      this.logError('总台登出失败', error, req);
      return this.sendError(res, '总台登出失败', 500);
    }
  });

  /**
   * 刷新总台令牌
   * POST /api/admin/console/auth/refresh
   */
  refreshToken = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('总台令牌刷新请求', req);

      const { refreshToken } = req.body;

      if (!refreshToken) {
        return this.sendError(res, '未提供刷新令牌', 400);
      }

      // 调用服务层刷新令牌
      const tokens = await this.consoleAuthService.refreshToken(refreshToken);

      return this.sendSuccess(res, '总台令牌刷新成功', {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType
      });

    } catch (error) {
      this.logError('总台令牌刷新失败', error, req);
      return this.sendError(res, error.message, 401);
    }
  });

  /**
   * 验证总台令牌
   * GET /api/admin/console/auth/verify
   */
  verifyToken = this.asyncHandler(async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return this.sendError(res, '未提供访问令牌', 400);
      }

      // 调用服务层验证令牌
      const decoded = await this.consoleAuthService.verifyToken(token);

      return this.sendSuccess(res, '总台令牌有效', {
        valid: true,
        user: {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
          userType: decoded.userType
        },
        expiresAt: new Date(decoded.exp * 1000)
      });

    } catch (error) {
      this.logError('总台令牌验证失败', error, req);
      return this.sendError(res, error.message, 401);
    }
  });

  /**
   * 获取总台登录状态
   * GET /api/admin/console/auth/status/:username
   */
  getLoginStatus = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取总台登录状态请求', req);

      const { username } = req.params;

      if (!username) {
        return this.sendError(res, '用户名不能为空', 400);
      }

      // 调用服务层获取登录状态
      const status = await this.consoleAuthService.getLoginStatus(username);

      return this.sendSuccess(res, '获取总台登录状态成功', status);

    } catch (error) {
      this.logError('获取总台登录状态失败', error, req);
      return this.sendError(res, '获取登录状态失败', 500);
    }
  });

  /**
   * 获取当前总台用户信息
   * GET /api/admin/console/auth/me
   */
  getCurrentUser = this.asyncHandler(async (req, res) => {
    try {
      this.logAction('获取当前总台用户信息请求', req);

      const user = req.user; // 来自认证中间件

      if (!user) {
        return this.sendError(res, '用户信息不存在', 401);
      }

      // 返回用户信息（不包含敏感信息）
      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        last_login: user.last_login,
        created_at: user.created_at
      };

      return this.sendSuccess(res, '获取用户信息成功', {
        user: userInfo
      });

    } catch (error) {
      this.logError('获取当前总台用户信息失败', error, req);
      return this.sendError(res, '获取用户信息失败', 500);
    }
  });
}

module.exports = ConsoleAuthController;
