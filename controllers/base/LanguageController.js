

/**
 * 语言控制器
 * 功能：提供语言相关的接口服务
 */

// 引入基础控制器类，获得统一的响应格式和错误处理能力
const BaseController = require('./BaseController');
const { COMMON_STATUS } = require('../../common/constants/status');

class LanguageController extends BaseController {
  constructor() {
    super();

    // 语言基础数据定义
    this.languages = [
      { id: 1, code: 'zh', name: '中文', nameEn: 'Chinese', nativeName: '中文', status: COMMON_STATUS.ENABLED },
      { id: 2, code: 'en', name: '英语', nameEn: 'English', nativeName: 'English', status: COMMON_STATUS.ENABLED },
      { id: 3, code: 'ja', name: '日语', nameEn: 'Japanese', nativeName: '日本語', status: COMMON_STATUS.ENABLED },
      { id: 4, code: 'ko', name: '韩语', nameEn: 'Korean', nativeName: '한국어', status: COMMON_STATUS.ENABLED },
      { id: 5, code: 'fr', name: '法语', nameEn: 'French', nativeName: 'Français', status: COMMON_STATUS.ENABLED },
      { id: 6, code: 'de', name: '德语', nameEn: 'German', nativeName: 'Deutsch', status: COMMON_STATUS.ENABLED },
      { id: 7, code: 'es', name: '西班牙语', nameEn: 'Spanish', nativeName: 'Español', status: COMMON_STATUS.ENABLED },
      { id: 8, code: 'it', name: '意大利语', nameEn: 'Italian', nativeName: 'Italiano', status: COMMON_STATUS.ENABLED },
      { id: 9, code: 'pt', name: '葡萄牙语', nameEn: 'Portuguese', nativeName: 'Português', status: COMMON_STATUS.ENABLED },
      { id: 10, code: 'ru', name: '俄语', nameEn: 'Russian', nativeName: 'Русский', status: COMMON_STATUS.ENABLED },
      { id: 11, code: 'ar', name: '阿拉伯语', nameEn: 'Arabic', nativeName: 'العربية', status: COMMON_STATUS.ENABLED },
      { id: 12, code: 'hi', name: '印地语', nameEn: 'Hindi', nativeName: 'हिन्दी', status: COMMON_STATUS.ENABLED },
      { id: 13, code: 'th', name: '泰语', nameEn: 'Thai', nativeName: 'ไทย', status: COMMON_STATUS.ENABLED },
      { id: 14, code: 'vi', name: '越南语', nameEn: 'Vietnamese', nativeName: 'Tiếng Việt', status: COMMON_STATUS.ENABLED },
      { id: 15, code: 'ms', name: '马来语', nameEn: 'Malay', nativeName: 'Bahasa Melayu', status: COMMON_STATUS.ENABLED },
      { id: 16, code: 'id', name: '印尼语', nameEn: 'Indonesian', nativeName: 'Bahasa Indonesia', status: COMMON_STATUS.ENABLED },
      { id: 17, code: 'tl', name: '菲律宾语', nameEn: 'Filipino', nativeName: 'Filipino', status: COMMON_STATUS.ENABLED },
      { id: 18, code: 'nl', name: '荷兰语', nameEn: 'Dutch', nativeName: 'Nederlands', status: COMMON_STATUS.ENABLED },
      { id: 19, code: 'sv', name: '瑞典语', nameEn: 'Swedish', nativeName: 'Svenska', status: COMMON_STATUS.ENABLED },
      { id: 20, code: 'no', name: '挪威语', nameEn: 'Norwegian', nativeName: 'Norsk', status: COMMON_STATUS.ENABLED },
      { id: 21, code: 'da', name: '丹麦语', nameEn: 'Danish', nativeName: 'Dansk', status: COMMON_STATUS.ENABLED },
      { id: 22, code: 'fi', name: '芬兰语', nameEn: 'Finnish', nativeName: 'Suomi', status: COMMON_STATUS.ENABLED },
      { id: 23, code: 'pl', name: '波兰语', nameEn: 'Polish', nativeName: 'Polski', status: COMMON_STATUS.ENABLED },
      { id: 24, code: 'tr', name: '土耳其语', nameEn: 'Turkish', nativeName: 'Türkçe', status: COMMON_STATUS.ENABLED },
      { id: 25, code: 'he', name: '希伯来语', nameEn: 'Hebrew', nativeName: 'עברית', status: COMMON_STATUS.ENABLED }
    ];
  }

  /**
   * 获取语言列表
   * GET /api/languages
   */
  getLanguages = this.asyncHandler(async (req, res) => {
    try {
      // this.logAction('获取语言列表请求', req);

      // 获取查询参数
      const { status } = req.query;

      // 过滤数据
      let filteredLanguages = [...this.languages];

      // 根据状态过滤
      if (status !== undefined) {
        const statusValue = parseInt(status);
        if (!isNaN(statusValue)) {
          filteredLanguages = filteredLanguages.filter(language => language.status === statusValue);
        }
      }

      // 返回成功响应
      return this.sendSuccess(res, '获取语言列表成功', {
        languages: filteredLanguages,
        total: filteredLanguages.length
      });

    } catch (error) {
      this.logError('获取语言列表失败', error, req);
      return this.sendError(res, '获取语言列表失败', 500);
    }
  });
}

// 导出语言控制器类
module.exports = LanguageController;
