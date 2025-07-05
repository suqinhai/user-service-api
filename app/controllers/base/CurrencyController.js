

/**
 * 货币控制器
 * 功能：提供货币相关的接口服务
 */

// 引入基础控制器类，获得统一的响应格式和错误处理能力
const BaseController = require('./BaseController');
const { COMMON_STATUS } = require('../../../common/constants/status');

class CurrencyController extends BaseController {
  constructor() {
    super();

    // 货币基础数据定义
    this.currencies = [
      { id: 1, code: 'CNY', name: '人民币', nameEn: 'Chinese Yuan', symbol: '¥', status: COMMON_STATUS.ENABLED },
      { id: 2, code: 'USD', name: '美元', nameEn: 'US Dollar', symbol: '$', status: COMMON_STATUS.ENABLED },
      { id: 3, code: 'EUR', name: '欧元', nameEn: 'Euro', symbol: '€', status: COMMON_STATUS.ENABLED },
      { id: 4, code: 'JPY', name: '日元', nameEn: 'Japanese Yen', symbol: '¥', status: COMMON_STATUS.ENABLED },
      { id: 5, code: 'GBP', name: '英镑', nameEn: 'British Pound', symbol: '£', status: COMMON_STATUS.ENABLED },
      { id: 6, code: 'KRW', name: '韩元', nameEn: 'South Korean Won', symbol: '₩', status: COMMON_STATUS.ENABLED },
      { id: 7, code: 'CAD', name: '加元', nameEn: 'Canadian Dollar', symbol: 'C$', status: COMMON_STATUS.ENABLED },
      { id: 8, code: 'AUD', name: '澳元', nameEn: 'Australian Dollar', symbol: 'A$', status: COMMON_STATUS.ENABLED },
      { id: 9, code: 'CHF', name: '瑞士法郎', nameEn: 'Swiss Franc', symbol: 'CHF', status: COMMON_STATUS.ENABLED },
      { id: 10, code: 'HKD', name: '港币', nameEn: 'Hong Kong Dollar', symbol: 'HK$', status: COMMON_STATUS.ENABLED },
      { id: 11, code: 'SGD', name: '新加坡元', nameEn: 'Singapore Dollar', symbol: 'S$', status: COMMON_STATUS.ENABLED },
      { id: 12, code: 'THB', name: '泰铢', nameEn: 'Thai Baht', symbol: '฿', status: COMMON_STATUS.ENABLED },
      { id: 13, code: 'MYR', name: '马来西亚林吉特', nameEn: 'Malaysian Ringgit', symbol: 'RM', status: COMMON_STATUS.ENABLED },
      { id: 14, code: 'IDR', name: '印尼盾', nameEn: 'Indonesian Rupiah', symbol: 'Rp', status: COMMON_STATUS.ENABLED },
      { id: 15, code: 'PHP', name: '菲律宾比索', nameEn: 'Philippine Peso', symbol: '₱', status: COMMON_STATUS.ENABLED },
      { id: 16, code: 'VND', name: '越南盾', nameEn: 'Vietnamese Dong', symbol: '₫', status: COMMON_STATUS.ENABLED },
      { id: 17, code: 'INR', name: '印度卢比', nameEn: 'Indian Rupee', symbol: '₹', status: COMMON_STATUS.ENABLED },
      { id: 18, code: 'BRL', name: '巴西雷亚尔', nameEn: 'Brazilian Real', symbol: 'R$', status: COMMON_STATUS.ENABLED },
      { id: 19, code: 'RUB', name: '俄罗斯卢布', nameEn: 'Russian Ruble', symbol: '₽', status: COMMON_STATUS.ENABLED },
      { id: 20, code: 'MXN', name: '墨西哥比索', nameEn: 'Mexican Peso', symbol: 'MX$', status: COMMON_STATUS.ENABLED },
      { id: 21, code: 'PKR', name: '巴基斯坦卢比', nameEn: 'Pakistani Rupee', symbol: '₨', status: COMMON_STATUS.ENABLED },
      { id: 22, code: 'TWD', name: '新台币', nameEn: 'Taiwan Dollar', symbol: 'NT$', status: COMMON_STATUS.ENABLED },
      { id: 23, code: 'SEK', name: '瑞典克朗', nameEn: 'Swedish Krona', symbol: 'kr', status: COMMON_STATUS.ENABLED },
      { id: 24, code: 'NOK', name: '挪威克朗', nameEn: 'Norwegian Krone', symbol: 'kr', status: COMMON_STATUS.ENABLED },
      { id: 25, code: 'DKK', name: '丹麦克朗', nameEn: 'Danish Krone', symbol: 'kr', status: COMMON_STATUS.ENABLED }
    ];
  }

  /**
   * 获取货币列表
   * GET /api/currencies
   */
  getCurrencies = this.asyncHandler(async (req, res) => {
    try {
    //   this.logAction('获取货币列表请求', req);

      // 获取查询参数
      const { status } = req.query;

      // 过滤数据
      let filteredCurrencies = [...this.currencies];

      // 根据状态过滤
      if (status !== undefined) {
        const statusValue = parseInt(status);
        if (!isNaN(statusValue)) {
          filteredCurrencies = filteredCurrencies.filter(currency => currency.status === statusValue);
        }
      }

      // 返回成功响应
      return this.sendSuccess(res, '成功', {
        currencies: filteredCurrencies,
        total: filteredCurrencies.length
      });

    } catch (error) {
      this.logError('失败', error, req);
      return this.sendError(res, '失败', 500);
    }
  });
}

// 导出货币控制器类
module.exports = CurrencyController;
