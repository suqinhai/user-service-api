/**
 * i18n配置模块
 * 负责初始化i18next，加载翻译资源
 */

const i18next = require('i18next');
const middleware = require('i18next-http-middleware');
const backend = require('i18next-fs-backend');
const path = require('path');

// 初始化i18next
const initI18n = async () => {
  await i18next
    .use(backend)
    .use(middleware.LanguageDetector)
    .init({
      // 支持的语言列表
      supportedLngs: ['zh', 'en'],
      
      // 后备语言，当请求的语言不存在时使用
      fallbackLng: 'zh',
      
      // 语言检测选项
      detection: {
        // 从请求中检测语言的顺序
        order: ['querystring', 'header', 'cookie'],
        
        // 用于存储语言设置的cookie名称
        lookupCookie: 'i18next',
        cookieExpirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1年
        
        // 查询参数名称
        lookupQuerystring: 'lang',
        
        // Accept-Language头部检测
        lookupHeader: 'accept-language',
        
        // 缓存语言设置
        caches: ['cookie']
      },
      
      // 命名空间
      ns: ['translation'],
      defaultNS: 'translation',
      
      // 调试模式（生产环境中应设为false）
      // debug: process.env.NODE_ENV === 'dev',
      debug: false,
      
      // 文件系统后端配置
      backend: {
        // 存储翻译文件的路径
        loadPath: path.join(__dirname, './locales/{{lng}}/{{ns}}.json'),
        // 添加新翻译的路径 (可选)
        addPath: path.join(__dirname, './locales/{{lng}}/{{ns}}.missing.json')
      },
      
      // 翻译内容相关选项
      interpolation: {
        escapeValue: false, // 不转义HTML
        formatSeparator: ',',
        format: (value, format) => {
          if (format === 'uppercase') return value.toUpperCase();
          if (format === 'lowercase') return value.toLowerCase();
          return value;
        }
      }
    });
  
  return i18next;
};

// 获取当前i18next实例
const getI18n = () => i18next;

// 创建Express中间件
const createMiddleware = () => {
  return middleware.handle(i18next);
};

module.exports = {
  initI18n,
  getI18n,
  createMiddleware
}; 