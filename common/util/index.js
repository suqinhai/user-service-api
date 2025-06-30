const path = require('path');
const fs = require('fs');
const clusterLogger = require('../logger/clusterLogger');

/**
 * 获取环境变量配置文件路径
 * @returns {string} 环境变量文件路径
 */
function getEnvPath() {
    const env = process.env.NODE_ENV || 'development';
    
    // 尝试不同的文件命名格式
    const possiblePaths = [
        path.resolve(__dirname, `../../env/${env}.env`),
        path.resolve(__dirname, `../../env/.env.${env}`),
        path.resolve(__dirname, `../../env/env.${env}`),
        path.resolve(__dirname, `../../env/${env}`),
        path.resolve(__dirname, `../../env/dev.env`), // 开发环境默认文件
    ];
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            console.log(`使用环境配置文件: ${filePath}`);
            return filePath;
        }
    }
    
    // 如果没有找到匹配的文件，但存在development.env，则使用它
    const devPath = path.resolve(__dirname, '../../env/development.env');
    if (fs.existsSync(devPath)) {
        console.log(`未找到匹配的环境配置文件，使用默认开发环境配置: ${devPath}`);
        return devPath;
    }
    
    // 兜底方案，使用基本的.env文件
    const defaultPath = path.resolve(__dirname, '../../env/.env');
    console.log(`未找到任何环境配置文件，使用默认配置: ${defaultPath}`);
    return defaultPath;
}

module.exports = {
    getEnvPath,
    clusterLogger,
};
