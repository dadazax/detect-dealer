require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// 中間件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 日誌文件路徑
const LOG_FILE = path.join(__dirname, 'monitor-logs.json');

// 初始化日誌文件
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({ checks: [] }, null, 2));
}

// 讀取日誌
function readLogs() {
  try {
    const data = fs.readFileSync(LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { checks: [] };
  }
}

// 寫入日誌
function writeLogs(logs) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// 記錄檢查結果
function logCheck(result) {
  const logs = readLogs();
  logs.checks.unshift({
    timestamp: new Date().toISOString(),
    ...result
  });

  // 只保留最近 100 條記錄
  if (logs.checks.length > 100) {
    logs.checks = logs.checks.slice(0, 100);
  }

  writeLogs(logs);
}

// API 路由

// 獲取監控狀態
app.get('/api/status', (req, res) => {
  const logs = readLogs();
  const lastCheck = logs.checks[0] || null;

  res.json({
    status: 'running',
    lastCheck: lastCheck,
    totalChecks: logs.checks.length,
    config: {
      url: process.env.MONITOR_URL,
      telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN
    }
  });
});

// 獲取歷史記錄
app.get('/api/history', (req, res) => {
  const logs = readLogs();
  const limit = parseInt(req.query.limit) || 20;
  res.json({
    checks: logs.checks.slice(0, limit)
  });
});

// 手動觸發檢查
app.post('/api/check', async (req, res) => {
  res.json({
    status: 'started',
    message: '檢查已啟動，請稍候查看結果'
  });

  // 在背景執行檢查
  exec('node monitor.js --test', (error, stdout, stderr) => {
    const errors = [];

    // 解析輸出尋找 404 錯誤
    const lines = stdout.split('\n');
    lines.forEach(line => {
      if (line.includes('❌ 發現 404 圖片:')) {
        const fileName = line.split('❌ 發現 404 圖片:')[1]?.trim();
        if (fileName) {
          errors.push({ fileName });
        }
      }
    });

    logCheck({
      type: 'manual',
      errorCount: errors.length,
      errors: errors,
      success: !error
    });
  });
});

// 獲取統計數據
app.get('/api/stats', (req, res) => {
  const logs = readLogs();
  const last24h = logs.checks.filter(check => {
    const checkTime = new Date(check.timestamp);
    const now = new Date();
    return (now - checkTime) < 24 * 60 * 60 * 1000;
  });

  const totalErrors = last24h.reduce((sum, check) => sum + (check.errorCount || 0), 0);
  const avgErrors = last24h.length > 0 ? (totalErrors / last24h.length).toFixed(2) : 0;

  res.json({
    last24h: {
      checks: last24h.length,
      totalErrors: totalErrors,
      avgErrors: avgErrors
    },
    allTime: {
      checks: logs.checks.length
    }
  });
});

// 清除歷史記錄
app.delete('/api/history', (req, res) => {
  writeLogs({ checks: [] });
  res.json({ message: '歷史記錄已清除' });
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌐 Web 儀表板已啟動`);
  console.log(`📊 訪問地址: http://localhost:${PORT}`);
  console.log(`🔧 API 端點:`);
  console.log(`   GET  /api/status   - 獲取監控狀態`);
  console.log(`   GET  /api/history  - 獲取歷史記錄`);
  console.log(`   POST /api/check    - 手動觸發檢查`);
  console.log(`   GET  /api/stats    - 獲取統計數據`);
  console.log('='.repeat(60));
  console.log(`\n💡 提示: 按 Ctrl+C 停止服務器\n`);
});

// 導出 logCheck 函數供 monitor.js 使用
module.exports = { logCheck };
