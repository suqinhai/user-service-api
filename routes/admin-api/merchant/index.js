// 引入Express框架，用于创建路由器
const express = require('express');
// 创建Express路由器实例，专门处理管理端用户管理相关的路由
const router = express.Router();
// 从中间件模块引入预定义的中间件堆栈和工厂函数
const { stacks, factories } = require('../../../middleware');

const { CountryController, CurrencyController, LanguageController } = require('../../../controllers');

const countryController = new CountryController();
const currencyController = new CurrencyController();
const languageController = new LanguageController();

// 获取国家列表路由
router.get('/countries', countryController.getCountries);

// 获取货币列表路由
router.get('/currencies', currencyController.getCurrencies);

// 获取语言列表路由
router.get('/languages', languageController.getLanguages);

// 导出路由器，供上级路由使用
module.exports = router;
