/**
 * 总台认证控制器
 * 处理总台管理员认证相关的HTTP请求
 */

const BaseController = require('../base/BaseController');
const ConsoleAuthService = require('../../services/admin/LoginAuthService');

class LoginAuthController extends BaseController {
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
}

module.exports = LoginAuthController;
