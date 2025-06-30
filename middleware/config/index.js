/**
 * 中间件配置文件
 * 统一管理所有中间件的配置参数
 */

// 限流配置
const RATE_LIMIT_CONFIG = {
  // 用户端限流配置
  USER: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000, // 每个IP每15分钟最多1000次请求
    message: {
      success: false,
      message: '请求过于频繁，请稍后再试',
      error: 'Too many requests from this IP, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipPaths: ['/health', '/']
  },
  
  // 管理端限流配置
  ADMIN: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 500, // 每个IP每15分钟最多500次请求
    message: {
      success: false,
      message: '管理端请求过于频繁，请稍后再试',
      error: 'Too many admin requests from this IP, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipPaths: []
  },
  
  // 通用限流配置
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 2000, // 每个IP每15分钟最多2000次请求
    message: {
      success: false,
      message: '请求过于频繁，请稍后再试',
      error: 'Too many requests from this IP, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipPaths: ['/health', '/', '/favicon.ico']
  }
};

// 缓存配置
const CACHE_CONFIG = {
  // 默认缓存配置
  DEFAULT: {
    ttl: 300, // 5分钟
    prefix: 'api_cache',
    enabled: true
  },
  
  // 用户数据缓存
  USER_DATA: {
    ttl: 600, // 10分钟
    prefix: 'user_data',
    enabled: true
  },
  
  // 管理数据缓存
  ADMIN_DATA: {
    ttl: 180, // 3分钟
    prefix: 'admin_data',
    enabled: true
  },
  
  // 静态数据缓存
  STATIC_DATA: {
    ttl: 3600, // 1小时
    prefix: 'static_data',
    enabled: true
  }
};

// 认证配置
const AUTH_CONFIG = {
  // JWT配置
  JWT: {
    secret: process.env.JWT_SECRET || 'default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    issuer: process.env.JWT_ISSUER || 'aa-admin-api',
    audience: process.env.JWT_AUDIENCE || 'aa-admin-users'
  },
  
  // Token缓存配置
  TOKEN_CACHE: {
    ttl: 300, // 5分钟
    prefix: 'auth_token'
  },
  
  // 用户缓存配置
  USER_CACHE: {
    ttl: 600, // 10分钟
    prefix: 'auth_user'
  }
};

// API类型配置
const API_TYPE_CONFIG = {
  TYPES: {
    USER: 'user',
    ADMIN: 'admin',
    MERCHANT: 'merchant',
    GENERAL: 'general'
  },
  
  HEADERS: {
    USER: {
      'X-API-Type': 'user',
      'X-API-Audience': 'end-user'
    },
    ADMIN: {
      'X-API-Type': 'admin',
      'X-API-Audience': 'administrator'
    },
    GENERAL: {
      'X-API-Type': 'general',
      'X-API-Audience': 'public'
    }
  }
};

// 性能监控配置
const PERFORMANCE_CONFIG = {
  // 是否启用性能监控
  enabled: process.env.NODE_ENV !== 'production' || process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  
  // 慢请求阈值（毫秒）
  slowRequestThreshold: 1000,
  
  // 统计数据保留时间（毫秒）
  statsRetentionTime: 24 * 60 * 60 * 1000, // 24小时
  
  // 是否记录请求详情
  logRequestDetails: process.env.NODE_ENV === 'development',
  
  // 内存监控阈值
  memoryThreshold: {
    warning: 100 * 1024 * 1024, // 100MB
    critical: 200 * 1024 * 1024  // 200MB
  }
};

// 审计配置
const AUDIT_CONFIG = {
  // 是否启用审计
  enabled: true,
  
  // 敏感操作类型
  sensitiveOperations: [
    'USER_CREATE',
    'USER_DELETE',
    'USER_UPDATE_ROLE',
    'ADMIN_LOGIN',
    'ADMIN_LOGOUT',
    'DATA_EXPORT',
    'SYSTEM_CONFIG_UPDATE',
    'PERMISSION_CHANGE'
  ],
  
  // 审计日志保留时间（天）
  retentionDays: 90,
  
  // 是否记录请求体
  logRequestBody: true,
  
  // 是否记录响应体
  logResponseBody: false
};

// 错误处理配置
const ERROR_CONFIG = {
  // 是否在响应中包含错误堆栈
  includeStack: process.env.NODE_ENV === 'development',
  
  // 是否记录错误详情
  logErrors: true,
  
  // 默认错误消息
  defaultMessage: '服务器内部错误',
  
  // 错误代码映射
  statusCodeMap: {
    ValidationError: 400,
    UnauthorizedError: 401,
    ForbiddenError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    RateLimitError: 429,
    InternalServerError: 500
  }
};

module.exports = {
  RATE_LIMIT_CONFIG,
  CACHE_CONFIG,
  AUTH_CONFIG,
  API_TYPE_CONFIG,
  PERFORMANCE_CONFIG,
  AUDIT_CONFIG,
  ERROR_CONFIG
};
