// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理管理端用户管理相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈和工厂函数
const { stacks, factories } = require('../../../middleware');
// 从控制器模块引入管理端用户管理控制器类
const { AdminUserController } = require('../../../controllers');

// 创建管理端用户管理控制器实例，用于处理具体的用户管理业务逻辑
const adminUserController = new AdminUserController();

// 获取用户列表路由：需要用户读取权限，支持分页、搜索和过滤
router.get('/', factories.createAdminPermissionStack(['user:read']), adminUserController.getUserList);

// 获取用户详情路由：需要用户读取权限，返回指定用户的完整信息
router.get('/:id', factories.createAdminPermissionStack(['user:read']), adminUserController.getUserDetail);

// 创建用户路由：需要用户创建权限，管理员可以创建新用户账户
router.post('/', factories.createAdminPermissionStack(['user:create']), adminUserController.createUser);

// 更新用户信息路由：需要用户写入权限，允许修改用户基本信息
router.put('/:id', factories.createAdminPermissionStack(['user:write']), adminUserController.updateUser);

// 更新用户状态路由：需要敏感操作权限，可以激活、禁用或锁定用户
router.patch('/:id/status', stacks.admin.sensitive, adminUserController.updateUserStatus);

// 重置用户密码路由：需要敏感操作权限，管理员可以重置用户密码
router.post('/:id/reset-password', stacks.admin.sensitive, adminUserController.resetUserPassword);

// 删除用户路由：需要敏感操作权限，永久删除用户账户（谨慎操作）
router.delete('/:id', stacks.admin.sensitive, adminUserController.deleteUser);

// 批量更新用户状态路由：需要用户写入权限，可以批量操作多个用户状态
router.patch('/batch/status', factories.createAdminPermissionStack(['user:write']), adminUserController.batchUpdateUserStatus);

// 获取用户统计信息路由：需要用户读取权限，返回用户相关的统计数据
router.get('/statistics', factories.createAdminPermissionStack(['user:read']), adminUserController.getUserStatistics);

router.get('/:id', factories.createAdminPermissionStack(['user:read']), function(req, res) {
  // TODO: 实现获取用户详情逻辑
  const { id } = req.params;
  
  res.sendSuccess('获取用户详情成功', {
    data: {
      message: '此接口待实现',
      type: 'admin-user-detail',
      endpoint: `/api/admin/users/${id}`,
      admin: req.user ? { id: req.user.id, username: req.user.username } : null,
      targetUserId: id
    }
  });
});

router.put('/:id/status',
  stacks.admin.sensitive,
  function(req, res) {
    // TODO: 实现更新用户状态逻辑
    const { id } = req.params;
    const { status, reason } = req.body;
    
    res.sendSuccess('用户状态更新成功', {
      data: {
        message: '此接口待实现',
        type: 'admin-user-status-update',
        endpoint: `/api/admin/users/${id}/status`,
        admin: req.user ? { id: req.user.id, username: req.user.username } : null,
        targetUserId: id,
        newStatus: status,
        reason: reason
      }
    });
  }
);

router.delete('/:id', stacks.admin.superAdmin, function(req, res) {
  // TODO: 实现删除用户逻辑
  const { id } = req.params;
  
  res.sendSuccess('用户删除成功', {
    data: {
      message: '此接口待实现',
      type: 'admin-user-delete',
      endpoint: `/api/admin/users/${id}`,
      admin: req.user ? { id: req.user.id, username: req.user.username } : null,
      deletedUserId: id
    }
  });
});

// 导出路由器，供上级路由使用
module.exports = router;
