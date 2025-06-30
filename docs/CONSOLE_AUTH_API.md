# 总台登录接口文档

## 概述

总台登录接口为系统的最高级别管理员提供专门的认证服务。该接口具有严格的安全控制，包括登录失败次数限制和账号锁定机制。

## 安全特性

- **登录失败限制**: 最多允许10次登录失败
- **账号锁定**: 10次失败后锁定到明天凌晨
- **严格限流**: 每15分钟最多3次登录尝试
- **专用令牌**: 8小时有效期的专用JWT令牌
- **操作审计**: 所有操作都会被记录和审计

## API 接口

### 1. 总台登录

**接口地址**: `POST /api/admin/console/auth/login`

**请求参数**:
```json
{
  "username": "console_admin",
  "password": "your_password"
}
```

**成功响应**:
```json
{
  "success": 1,
  "message": "总台登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "console_admin",
      "email": "console@example.com",
      "role": 4,
      "status": 1,
      "last_login": "2025-06-30T10:00:00.000Z",
      "created_at": "2025-06-30T09:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "8h",
    "tokenType": "Bearer",
    "loginTime": "2025-06-30T10:00:00.000Z"
  },
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

**失败响应**:
```json
{
  "success": 0,
  "message": "登录失败，还有7次尝试机会",
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

**锁定响应**:
```json
{
  "success": 0,
  "message": "账号已被锁定，请明天再试。解锁时间：2025-07-01T00:00:00.000Z",
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

### 2. 总台登出

**接口地址**: `POST /api/admin/console/auth/logout`

**请求头**:
```
Authorization: Bearer <access_token>
```

**成功响应**:
```json
{
  "success": 1,
  "message": "总台登出成功",
  "data": {
    "logoutTime": "2025-06-30T10:00:00.000Z"
  },
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

### 3. 刷新令牌

**接口地址**: `POST /api/admin/console/auth/refresh`

**请求参数**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**成功响应**:
```json
{
  "success": 1,
  "message": "总台令牌刷新成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "8h",
    "tokenType": "Bearer"
  },
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

### 4. 验证令牌

**接口地址**: `GET /api/admin/console/auth/verify`

**请求头**:
```
Authorization: Bearer <access_token>
```

**成功响应**:
```json
{
  "success": 1,
  "message": "总台令牌有效",
  "data": {
    "valid": true,
    "user": {
      "id": 1,
      "username": "console_admin",
      "email": "console@example.com",
      "role": 4,
      "userType": "console_admin"
    },
    "expiresAt": "2025-06-30T18:00:00.000Z"
  },
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

### 5. 获取登录状态

**接口地址**: `GET /api/admin/console/auth/status/:username`

**请求头**:
```
Authorization: Bearer <access_token>
```

**成功响应**:
```json
{
  "success": 1,
  "message": "获取总台登录状态成功",
  "data": {
    "isLocked": false,
    "lockUntil": null,
    "failedAttempts": 2,
    "remainingAttempts": 8,
    "message": "账号未被锁定"
  },
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

### 6. 获取当前用户信息

**接口地址**: `GET /api/admin/console/auth/me`

**请求头**:
```
Authorization: Bearer <access_token>
```

**成功响应**:
```json
{
  "success": 1,
  "message": "获取用户信息成功",
  "data": {
    "user": {
      "id": 1,
      "username": "console_admin",
      "email": "console@example.com",
      "role": 4,
      "status": 1,
      "last_login": "2025-06-30T10:00:00.000Z",
      "created_at": "2025-06-30T09:00:00.000Z"
    }
  },
  "timestamp": "2025-06-30T10:00:00.000Z"
}
```

## 错误码说明

| HTTP状态码 | 错误类型 | 说明 |
|-----------|---------|------|
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 认证失败或令牌无效 |
| 403 | Forbidden | 无权限访问 |
| 423 | Locked | 账号被锁定 |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |

## 使用示例

### 创建总台管理员

```bash
# 使用脚本创建总台管理员
cd aa-admin/init-expresss-api
node scripts/create-console-admin.js console_admin admin123456 console@example.com
```

### 登录示例

```bash
# 总台登录
curl -X POST http://localhost:3000/api/admin/console/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "console_admin",
    "password": "admin123456"
  }'
```

### 使用令牌访问

```bash
# 获取当前用户信息
curl -X GET http://localhost:3000/api/admin/console/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 注意事项

1. **安全性**: 总台账号具有最高权限，请妥善保管账号密码
2. **锁定机制**: 账号锁定后只能等到明天凌晨自动解锁
3. **令牌管理**: 访问令牌8小时有效，刷新令牌24小时有效
4. **审计日志**: 所有总台操作都会被记录，请合规使用
5. **限流控制**: 请避免频繁请求，遵守接口限流规则

## 故障排除

### 常见问题

1. **登录失败**: 检查用户名密码是否正确，确认账号未被锁定
2. **令牌过期**: 使用刷新令牌获取新的访问令牌
3. **权限不足**: 确认用户角色为总台管理员(role=4)
4. **账号锁定**: 等待到明天凌晨自动解锁，或联系系统管理员

### 日志查看

```bash
# 查看总台相关日志
tail -f logs/$(date +%Y-%m-%d)-app.log | grep "总台"
```
