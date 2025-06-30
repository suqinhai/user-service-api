#!/usr/bin/env node

/**
 * 开发环境启动脚本
 * 功能：自动检查端口占用、终止冲突进程、启动nodemon热重载服务
 * 用法: node start-dev.js
 */

// 引入Node.js子进程模块，用于执行系统命令和启动子进程
const { execSync, spawn } = require('child_process');
// 引入文件系统模块，用于检查文件和目录是否存在
const fs = require('fs');
// 引入路径处理模块，用于处理文件路径
const path = require('path');
// 引入操作系统模块，用于获取系统信息
const os = require('os');
// 检测当前运行平台是否为Windows系统
const isWin = process.platform === 'win32';
// 定义开发环境使用的端口号
const port = 3002; // 开发环境端口

// 定义控制台彩色输出的ANSI转义码，用于美化终端输出
const color = {
  reset: '\x1b[0m',    // 重置颜色
  red: '\x1b[31m',     // 红色，用于错误信息
  green: '\x1b[32m',   // 绿色，用于成功信息
  yellow: '\x1b[33m',  // 黄色，用于警告信息
  blue: '\x1b[34m',    // 蓝色，用于一般信息
  magenta: '\x1b[35m', // 洋红色
  cyan: '\x1b[36m'     // 青色，用于标题和重要信息
};

// 输出启动脚本的标题横幅，使用青色突出显示
console.log(`${color.cyan}========================================${color.reset}`);
console.log(`${color.cyan}  Express API 开发环境启动脚本${color.reset}`);
console.log(`${color.cyan}========================================${color.reset}`);

// 检查开发环境配置文件是否存在
const envPath = path.resolve(__dirname, 'env/dev.env');
if (!fs.existsSync(envPath)) {
  // 如果环境配置文件不存在，输出警告但不阻止启动
  console.log(`${color.yellow}警告: 未找到环境配置文件 ${envPath}${color.reset}`);
  console.log(`${color.yellow}将尝试使用默认配置${color.reset}`);
}

// 检查指定端口是否被其他进程占用，避免启动冲突
try {
  console.log(`${color.blue}检查端口 ${port} 是否被占用...${color.reset}`);

  // 根据操作系统选择不同的端口检查命令
  let command;
  if (isWin) {
    // Windows系统：使用netstat命令查找端口占用情况
    command = `netstat -ano | findstr :${port}`;
  } else {
    // Unix/Linux/macOS系统：使用lsof命令查找监听端口的进程
    command = `lsof -i :${port} | grep LISTEN`;
  }

  // 同步执行命令并获取结果
  const result = execSync(command, { encoding: 'utf8' });
  if (result && result.trim()) {
    // 如果有结果，说明端口被占用
    console.log(`${color.red}端口 ${port} 已被占用:${color.reset}`);
    console.log(result);
    console.log(`${color.yellow}尝试终止占用端口的进程...${color.reset}`);

    // 从命令输出中提取进程ID(PID)
    let pid;
    if (isWin) {
      // Windows：PID通常在输出的最后一列
      const match = result.trim().match(/\s+(\d+)$/m);
      if (match && match[1]) {
        pid = match[1];
      }
    } else {
      // Unix系统：PID通常在第二列
      const match = result.trim().split(/\s+/)[1];
      if (match) {
        pid = match;
      }
    }

    if (pid) {
      // 根据操作系统选择相应的进程终止命令
      const killCommand = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
      // 强制终止占用端口的进程
      execSync(killCommand);
      console.log(`${color.green}已终止PID为 ${pid} 的进程${color.reset}`);
    } else {
      // 如果无法提取PID，提示用户手动处理
      console.log(`${color.red}无法确定PID，请手动终止进程${color.reset}`);
      process.exit(1);
    }
  } else {
    // 如果没有输出结果，说明端口未被占用
    console.log(`${color.green}端口 ${port} 可用${color.reset}`);
  }
} catch (error) {
  // 捕获命令执行异常，区分真正的错误和正常的"未找到进程"情况
  if (!error.message.includes('No such process') && !error.message.includes('没有')) {
    console.error(`${color.red}检查端口时出错: ${error.message}${color.reset}`);
  }
  // 如果是因为没有找到占用进程而报错，则认为端口可用
  console.log(`${color.green}端口 ${port} 可用${color.reset}`);
}

// 输出应用启动信息
console.log(`${color.blue}正在启动应用...${color.reset}`);
console.log(`${color.blue}环境: dev, 端口: ${port}${color.reset}`);

// 设置Node.js进程的环境变量，确保应用以开发模式运行
process.env.NODE_ENV = 'dev';
process.env.PORT = port.toString();

// 检查并使用nodemon启动应用，实现代码热重载功能
const nodemonPath = path.resolve(__dirname, 'node_modules', '.bin', isWin ? 'nodemon.cmd' : 'nodemon');
if (!fs.existsSync(nodemonPath)) {
  // 如果nodemon未安装，自动安装到开发依赖
  console.log(`${color.red}未找到 nodemon，正在安装...${color.reset}`);
  execSync('npm install nodemon --save-dev', { stdio: 'inherit' });
}

try {
  // 使用spawn启动nodemon子进程，监控./bin/www入口文件
  const nodemon = spawn(nodemonPath, ['./bin/www'], {
    stdio: 'inherit',  // 继承父进程的标准输入输出，实现日志直接显示
    env: { ...process.env, NODE_ENV: 'dev', PORT: port.toString() }  // 传递环境变量
  });

  // 监听nodemon启动错误事件
  nodemon.on('error', (error) => {
    console.error(`${color.red}启动 nodemon 失败: ${error.message}${color.reset}`);
  });

  // 处理Ctrl+C信号，优雅地关闭应用
  process.on('SIGINT', () => {
    // 终止nodemon子进程
    nodemon.kill();
    console.log(`\n${color.yellow}应用已停止${color.reset}`);
    // 退出主进程
    process.exit(0);
  });
} catch (error) {
  // 捕获启动过程中的异常并输出错误信息
  console.error(`${color.red}启动失败: ${error.message}${color.reset}`);
}