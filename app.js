// 引入HTTP错误处理模块，用于创建标准化的HTTP错误对象
var createError = require('http-errors');
// 引入Express框架，用于构建Web应用和API
var express = require('express');
// 引入Node.js路径处理模块，用于处理文件和目录路径
var path = require('path');
// 引入Cookie解析中间件，用于解析HTTP请求中的Cookie
var cookieParser = require('cookie-parser');
// 注释掉的body-parser，Express 4.16+已内置JSON和URL编码解析
// var bodyParser = require('body-parser');
// 引入CORS中间件，用于处理跨域资源共享
var cors = require('cors');
// 引入Helmet安全中间件，用于设置各种HTTP安全头部
var helmet = require('helmet');
// 引入压缩中间件，用于压缩HTTP响应以减少传输大小
var compression = require('compression');

// 引入Morgan HTTP请求日志中间件，重命名以避免与自定义logger冲突
var morganLogger = require('morgan');  // 重命名morgan日志器，避免冲突
// 从自定义日志模块导入请求日志器和通用日志器
var { requestLogger, logger } = require('./common/logger'); // 直接从logger模块导入

// 从公共模块导入数据库连接、响应处理函数、国际化等核心功能
var { sequelize, mongodb, sendSuccess, sendError, sendBadRequest, sendUnauthorized, sendResponse, initI18n, createMiddleware } = require('./common/index')
// 从中间件模块导入全局限流器
var { globalLimiter } = require('./middleware');

// 注释掉的主页路由，当前项目专注于API服务
// var indexRouter = require('./routes/index');
// 创建Express应用实例
var app = express();

// 异步初始化应用的核心组件：国际化和数据库连接
(async () => {
  try {
    // 初始化国际化(i18n)模块，支持多语言功能
    await initI18n();
    console.log('i18n initialized successfully');

    // 尝试初始化MongoDB连接（可选数据库）
    try {
      // 连接到MongoDB数据库，用于存储非关系型数据
      await mongodb.connectMongoDB();
      console.log('MongoDB connection initialized successfully');
    } catch (error) {
      // MongoDB连接失败时不影响应用启动，仅记录警告
      console.warn('MongoDB connection failed, continuing without MongoDB:', error.message);
    }
  } catch (error) {
    // i18n初始化失败时记录错误，但不阻止应用启动
    console.error('Failed to initialize i18n:', error);
  }
})();

// 添加国际化中间件到Express应用 (必须在其他路由之前注册)
app.use(createMiddleware());

// 配置视图引擎设置
// 设置视图文件目录为项目根目录下的views文件夹
app.set('views', path.join(__dirname, 'views'));
// 设置模板引擎为EJS，用于服务端渲染HTML页面
app.set('view engine', 'ejs');

// 使用Helmet中间件增强Web应用安全性，设置多种安全相关的HTTP头部
app.use(helmet({
  // 内容安全策略(CSP)配置，防止XSS攻击和数据注入
  contentSecurityPolicy: {
    directives: {
      // 默认资源来源限制为同源
      defaultSrc: ["'self'"],
      // 脚本来源：允许同源和内联脚本（开发需要）
      scriptSrc: ["'self'", "'unsafe-inline'"], // 允许内联脚本
      // 样式来源：允许同源和内联样式（UI框架需要）
      styleSrc: ["'self'", "'unsafe-inline'"], // 允许内联样式
      // 图片来源：允许同源和data URL（base64图片）
      imgSrc: ["'self'", 'data:'], // 允许数据URL图片
      // 连接来源：限制为同源（AJAX请求等）
      connectSrc: ["'self'"],
      // 字体来源：限制为同源
      fontSrc: ["'self'"],
      // 对象来源：完全禁止（防止插件漏洞）
      objectSrc: ["'none'"],
      // 媒体来源：限制为同源
      mediaSrc: ["'self'"],
      // 框架来源：完全禁止（防止点击劫持）
      frameSrc: ["'none'"],
    }
  },
  // 跨域嵌入策略：禁用以允许第三方资源嵌入
  crossOriginEmbedderPolicy: false, // 如果需要嵌入第三方资源，可能需要禁用此策略
  // 跨域开启策略：同源策略，防止跨域攻击
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  // 跨域资源策略：同站策略，限制跨域资源访问
  crossOriginResourcePolicy: { policy: 'same-site' },
  // 其他重要的安全头部设置
  // XSS过滤器：启用浏览器内置XSS防护
  xssFilter: true,
  // MIME类型嗅探防护：防止浏览器错误解析文件类型
  noSniff: true,
  // HTTP严格传输安全(HSTS)：强制使用HTTPS
  hsts: {
    maxAge: 15552000, // 有效期180天（秒）
    includeSubDomains: true, // 包含所有子域名
    preload: true // 允许加入HSTS预加载列表
  }
}));

// 使用Gzip压缩中间件减小HTTP响应体积，提高网络传输速度
app.use(compression({
  level: 6,                    // 压缩级别，范围1-9，数字越大压缩率越高但CPU消耗越多，6是平衡点
  threshold: 1024,             // 压缩阈值：只对大于1KB的响应进行压缩，避免小文件压缩开销
  filter: (req, res) => {      // 自定义过滤器函数，决定哪些响应需要压缩
    // 如果请求头包含x-no-compression，则跳过压缩
    if (req.headers['x-no-compression']) {
      return false;            // 不压缩带有特定头部的请求（用于调试或特殊需求）
    }
    // 使用compression模块的默认过滤器（检查Content-Type等）
    return compression.filter(req, res); // 使用默认过滤器
  }
}));

// 应用全局API请求限流中间件，防止API滥用和DDoS攻击
app.use(globalLimiter);

// 注释掉的body-parser，现在使用Express内置的JSON解析器
// app.use(bodyParser.json());
// 自定义中间件：为每个响应对象添加数据库连接和统一响应方法
app.use(function (req, res, next) {
  // 将Sequelize数据库连接对象附加到响应对象，便于在路由中使用
  res.sequelize = sequelize;
  // 将MongoDB数据库连接对象附加到响应对象
  res.mongodb = mongodb;
  // 添加通用响应方法：自定义状态码和消息的响应
  res.sendResponse = (status, success, message, options) => sendResponse(res, status, success, message, options);
  // 添加成功响应方法：返回200状态码和成功消息
  res.sendSuccess = (message, options) => sendSuccess(res, message, options);
  // 添加错误请求响应方法：返回400状态码和错误消息
  res.sendBadRequest = (message, options) => sendBadRequest(res, message, options);
  // 添加未授权响应方法：返回401状态码和未授权消息
  res.sendUnauthorized = (message, options) => sendUnauthorized(res, message, options);
  // 继续执行下一个中间件
  next();
});
// 根据运行环境选择不同的HTTP请求日志记录策略
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
  // 开发环境：使用Morgan日志器，输出简洁的彩色日志到控制台
  app.use(morganLogger('dev')); // 使用重命名的morgan日志器
} else {
  // 生产环境：使用Winston结构化日志器，支持日志轮转和持久化存储
  app.use(requestLogger()); // 使用Winston的requestLogger
}
// 启用CORS跨域资源共享，允许前端应用访问API
app.use(cors());
// 启用Express内置JSON解析中间件，解析application/json请求体
app.use(express.json());
// 启用Express内置URL编码解析中间件，解析application/x-www-form-urlencoded请求体
app.use(express.urlencoded({ extended: false }));
// 启用Cookie解析中间件，解析HTTP请求中的Cookie数据
app.use(cookieParser());
// 配置静态资源服务和智能缓存策略，优化前端资源加载性能
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,                // 启用ETag头部，用于缓存验证和条件请求
  lastModified: true,        // 启用Last-Modified头部，提供文件修改时间信息
  setHeaders: (res, path) => {
    // 根据不同文件类型设置差异化的HTTP缓存策略
    if (path.endsWith('.html')) {
      // HTML文件：设置较短缓存时间，确保内容更新及时生效
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5分钟缓存
    } else if (path.match(/\.(css|js)$/)) {
      // CSS和JavaScript文件：中等缓存时间，平衡更新频率和性能
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1天缓存
    } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg|webp)$/)) {
      // 图片文件：长期缓存，图片资源变更频率低
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30天缓存
    } else if (path.match(/\.(woff|woff2|ttf|eot|otf)$/)) {
      // 字体文件：超长期缓存，字体文件几乎不变更
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
    } else {
      // 其他静态资源：默认缓存策略，适用于未分类的文件类型
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1小时缓存
    }
  }
}));

// 引入并注册主路由模块，所有API路由都以/api为前缀
const routes = require('./routes');
app.use('/api', routes);

// 从中间件模块导入快速错误处理器
const { quick } = require('./middleware');
const { errorHandler, notFoundHandler } = quick;

// 注册404错误处理中间件，捕获未匹配的路由请求
app.use(notFoundHandler);

// 注册全局错误处理中间件，处理应用中的所有错误
app.use(errorHandler);

// 导出Express应用实例，供启动脚本使用
module.exports = app;
