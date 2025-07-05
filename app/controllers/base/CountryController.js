
/**
 * 国家控制器
 * 功能：提供国家相关的接口服务
 */

// 引入基础控制器类，获得统一的响应格式和错误处理能力
const BaseController = require('./BaseController');
const { COMMON_STATUS } = require('../../../common/constants/status');

class CountryController extends BaseController {
  constructor() {
    super();

    // 国家基础数据定义
    this.countries = [
      { id: 1, code: 'CN', name: '中国', nameEn: 'China', status: COMMON_STATUS.ENABLED },
      { id: 2, code: 'US', name: '美国', nameEn: 'United States', status: COMMON_STATUS.ENABLED },
      { id: 3, code: 'JP', name: '日本', nameEn: 'Japan', status: COMMON_STATUS.ENABLED },
      { id: 4, code: 'KR', name: '韩国', nameEn: 'South Korea', status: COMMON_STATUS.ENABLED },
      { id: 5, code: 'GB', name: '英国', nameEn: 'United Kingdom', status: COMMON_STATUS.ENABLED },
      { id: 6, code: 'DE', name: '德国', nameEn: 'Germany', status: COMMON_STATUS.ENABLED },
      { id: 7, code: 'FR', name: '法国', nameEn: 'France', status: COMMON_STATUS.ENABLED },
      { id: 8, code: 'IT', name: '意大利', nameEn: 'Italy', status: COMMON_STATUS.ENABLED },
      { id: 9, code: 'ES', name: '西班牙', nameEn: 'Spain', status: COMMON_STATUS.ENABLED },
      { id: 10, code: 'CA', name: '加拿大', nameEn: 'Canada', status: COMMON_STATUS.ENABLED },
      { id: 11, code: 'AU', name: '澳大利亚', nameEn: 'Australia', status: COMMON_STATUS.ENABLED },
      { id: 12, code: 'BR', name: '巴西', nameEn: 'Brazil', status: COMMON_STATUS.ENABLED },
      { id: 13, code: 'IN', name: '印度', nameEn: 'India', status: COMMON_STATUS.ENABLED },
      { id: 14, code: 'RU', name: '俄罗斯', nameEn: 'Russia', status: COMMON_STATUS.ENABLED },
      { id: 15, code: 'MX', name: '墨西哥', nameEn: 'Mexico', status: COMMON_STATUS.ENABLED },
      { id: 16, code: 'SG', name: '新加坡', nameEn: 'Singapore', status: COMMON_STATUS.ENABLED },
      { id: 17, code: 'TH', name: '泰国', nameEn: 'Thailand', status: COMMON_STATUS.ENABLED },
      { id: 18, code: 'MY', name: '马来西亚', nameEn: 'Malaysia', status: COMMON_STATUS.ENABLED },
      { id: 19, code: 'ID', name: '印度尼西亚', nameEn: 'Indonesia', status: COMMON_STATUS.ENABLED },
      { id: 20, code: 'PH', name: '菲律宾', nameEn: 'Philippines', status: COMMON_STATUS.ENABLED },
      { id: 21, code: 'VN', name: '越南', nameEn: 'Vietnam', status: COMMON_STATUS.ENABLED },
      { id: 22, code: 'NL', name: '荷兰', nameEn: 'Netherlands', status: COMMON_STATUS.ENABLED },
      { id: 23, code: 'CH', name: '瑞士', nameEn: 'Switzerland', status: COMMON_STATUS.ENABLED },
      { id: 24, code: 'SE', name: '瑞典', nameEn: 'Sweden', status: COMMON_STATUS.ENABLED },
      { id: 25, code: 'NO', name: '挪威', nameEn: 'Norway', status: COMMON_STATUS.ENABLED }
    ];
  }

  /**
   * 获取国家列表
   * GET /api/countries
   */
  getCountries = this.asyncHandler(async (req, res) => {
    try {
    //   this.logAction('获取国家列表请求', req);

      // 获取查询参数
      const { status } = req.query;

      // 过滤数据
      let filteredCountries = [...this.countries];

      // 根据状态过滤
      if (status !== undefined) {
        const statusValue = parseInt(status);
        if (!isNaN(statusValue)) {
          filteredCountries = filteredCountries.filter(country => country.status === statusValue);
        }
      }

      // 返回成功响应
      return this.sendSuccess(res, '成功', {
        countries: filteredCountries,
        total: filteredCountries.length
      });

    } catch (error) {
      this.logError('失败', error, req);
      return this.sendError(res, '失败', 500);
    }
  });
}

// 导出国家控制器类
module.exports = CountryController;
