// 定时任务
const cron = require('node-cron');

// 每分钟执行一次
cron.schedule('* * * * *', () => {
  // console.log('每分钟执行的任务');
});

// 每天凌晨执行
cron.schedule('0 0 * * *', () => {
  // console.log('每天凌晨执行的任务');
});

module.exports = {
    cron
}