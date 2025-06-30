#!/usr/bin/env node

/**
 * 终止占用特定端口的进程
 * 用法: node kill-port.js [端口号]
 */

const { exec } = require('child_process');
const port = process.argv[2] || 3001;
const isWin = process.platform === 'win32';

console.log(`正在查找占用端口 ${port} 的进程...`);

if (isWin) {
  // Windows系统
  exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
    if (error) {
      console.error(`查找进程出错: ${error.message}`);
      return;
    }

    if (!stdout) {
      console.log(`未找到占用端口 ${port} 的进程`);
      return;
    }

    // 解析输出，获取PID
    const lines = stdout.split('\n').filter(Boolean);
    console.log('找到以下进程:');
    console.log(stdout);

    // 提取第一个找到的PID（通常在最后一列）
    const pidMatch = lines[0].trim().match(/\s+(\d+)$/);
    if (pidMatch && pidMatch[1]) {
      const pid = pidMatch[1];
      console.log(`正在终止进程 PID: ${pid}`);
      
      exec(`taskkill /F /PID ${pid}`, (err, output) => {
        if (err) {
          console.error(`终止进程失败: ${err.message}`);
          return;
        }
        console.log(`进程已终止: ${output.trim()}`);
        console.log(`端口 ${port} 现在可用`);
      });
    } else {
      console.log('无法确定PID，请手动终止进程');
    }
  });
} else {
  // Unix/Linux/MacOS系统
  exec(`lsof -i :${port} | grep LISTEN`, (error, stdout) => {
    if (error) {
      // 如果没有进程占用该端口，lsof 会返回非零退出码
      if (error.code > 1) { // 非标准错误（1通常表示没有找到结果）
        console.error(`查找进程出错: ${error.message}`);
      } else {
        console.log(`未找到占用端口 ${port} 的进程`);
      }
      return;
    }

    if (!stdout) {
      console.log(`未找到占用端口 ${port} 的进程`);
      return;
    }

    // 解析输出，获取PID（通常在第2列）
    const lines = stdout.split('\n').filter(Boolean);
    console.log('找到以下进程:');
    console.log(stdout);
    
    // 提取PID
    const pidMatch = lines[0].trim().split(/\s+/)[1];
    if (pidMatch) {
      const pid = pidMatch;
      console.log(`正在终止进程 PID: ${pid}`);
      
      exec(`kill -9 ${pid}`, (err, output) => {
        if (err) {
          console.error(`终止进程失败: ${err.message}`);
          return;
        }
        console.log(`进程已终止`);
        console.log(`端口 ${port} 现在可用`);
      });
    } else {
      console.log('无法确定PID，请手动终止进程');
    }
  });
} 