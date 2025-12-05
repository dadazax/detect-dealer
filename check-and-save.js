require('dotenv').config();
const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  url: process.env.MONITOR_URL,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  headless: process.env.HEADLESS !== 'false',
};

const bot = new TelegramBot(CONFIG.telegramToken, { polling: false });

// 點擊座標
const CLICK_POSITIONS = [
  { name: '歐廳', x: 189, y: 218 },
  { name: '百家樂', x: 265, y: 218 },
  { name: '競速', x: 341, y: 218 },
  { name: '龍虎', x: 416, y: 218 },
  { name: '21點', x: 492, y: 218 },
  { name: '歐利廳', x: 33, y: 360 },
];

async function clickCanvas(page, x, y) {
  await page.evaluate((x, y) => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      });
      canvas.dispatchEvent(event);
    }
  }, x, y);
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendTelegramMessage(message) {
  try {
    await bot.sendMessage(CONFIG.telegramChatId, message, {
      parse_mode: 'Markdown',
    });
    console.log('✅ Telegram 訊息已發送');
  } catch (error) {
    console.error('❌ 發送 Telegram 訊息失敗:', error.message);
  }
}

function saveResults(data) {
  const dataDir = path.join(__dirname, 'docs', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 保存最新結果
  const latestFile = path.join(dataDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(data, null, 2));

  // 保存歷史記錄
  const historyFile = path.join(dataDir, 'history.json');
  let history = { checks: [] };

  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (error) {
      console.error('讀取歷史記錄失敗:', error.message);
    }
  }

  history.checks.unshift(data);

  // 只保留最近 100 條記錄
  if (history.checks.length > 100) {
    history.checks = history.checks.slice(0, 100);
  }

  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  console.log('✅ 結果已保存');
}

async function checkWebsite() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 開始檢查網站: ${new Date().toLocaleString('zh-TW')}`);
  console.log('='.repeat(60));

  // 調試信息
  console.log(`⚙️  配置:`);
  console.log(`   - Headless: ${CONFIG.headless}`);
  console.log(`   - DISPLAY: ${process.env.DISPLAY || '(未設置)'}`);
  console.log(`   - URL: ${CONFIG.url}`);

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled', // 防止被檢測為自動化
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security', // 允許跨域（僅用於監控）
      '--enable-webgl', // 啟用 WebGL
      '--use-gl=swiftshader', // 使用軟體 GPU 模擬
      '--enable-accelerated-2d-canvas', // 啟用 Canvas 加速
      '--disable-gpu-sandbox', // 禁用 GPU 沙盒限制
      '--window-size=1920,1080', // 設置視窗大小
    ],
  });

  const page = await browser.newPage();

  // 設置視窗大小和 User Agent 讓瀏覽器看起來更真實
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // 隱藏 webdriver 標誌
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  const failed404Images = new Map();
  const successImages = new Map();
  const allImages = new Map();

  // 設置監聽器在導航之前，確保捕獲所有請求
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const resourceType = response.request().resourceType();

    if (resourceType === 'image') {
      const fileName = url.split('/').pop();
      const imageInfo = {
        url,
        fileName,
        status,
      };

      // 記錄所有圖片
      if (!allImages.has(url)) {
        allImages.set(url, imageInfo);
      }

      if (status === 404) {
        if (!failed404Images.has(url)) {
          failed404Images.set(url, imageInfo);
          console.log(`❌ 發現 404 圖片: ${fileName}`);
        }
      } else if (status === 200 || status === 304) {
        // 200: 正常加載, 304: 從緩存加載（也是正常的）
        if (!successImages.has(url)) {
          successImages.set(url, imageInfo);
          console.log(`✅ 正常圖片: ${fileName} (HTTP ${status})`);
        }
      }
    }
  });

  try {
    console.log('📡 正在訪問網站...');
    await page.goto(CONFIG.url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待遊戲完全加載（這需要較長時間）...');
    await delay(150000);  // 等待 2.5 分鐘讓遊戲完全加載

    console.log('✅ 遊戲應該已加載完成，正在收集圖片資源...');

    // 📸 調試：拍攝截圖查看實際顯示內容
    try {
      const screenshotPath = path.join(__dirname, 'debug-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 調試截圖已保存: ${screenshotPath}`);
    } catch (err) {
      console.log('截圖失敗:', err.message);
    }

    // 遊戲加載完成後，荷官圖片已經顯示，不需要點擊
    // 點擊操作已移除，因為它們在遊戲未加載時無效

    console.log('⏳ 最後確認所有資源已捕獲...');
    await delay(10000);  // 再等 10 秒確保所有請求完成

    const errorCount = failed404Images.size;
    const successCount = successImages.size;
    const totalCount = allImages.size;
    const errors = Array.from(failed404Images.values());
    const successList = Array.from(successImages.values());

    console.log(`\n📊 檢查完成！`);
    console.log(`總共檢查 ${totalCount} 個圖片`);
    console.log(`✅ 正常: ${successCount} 個`);
    console.log(`❌ 錯誤: ${errorCount} 個`);

    // 準備結果數據
    const resultData = {
      timestamp: new Date().toISOString(),
      totalCount: totalCount,
      successCount: successCount,
      errorCount: errorCount,
      successImages: successList,
      errors: errors,
      success: errorCount === 0,
      url: CONFIG.url,
    };

    // 保存結果
    saveResults(resultData);

    // 發送 Telegram 通知
    if (errorCount > 0) {
      let message = `🚨 *網站圖片 404 錯誤警報*\n\n`;
      message += `🌐 網站: PlayAce 遊戲平台\n`;
      message += `⏰ 時間: ${new Date().toLocaleString('zh-TW')}\n`;
      message += `❌ 發現 ${errorCount} 個圖片無法加載\n\n`;
      message += `📋 *錯誤清單:*\n`;

      errors.forEach((error, index) => {
        message += `\n${index + 1}. \`${error.fileName}\`\n`;
        message += `   URL: ${error.url}\n`;
      });

      await sendTelegramMessage(message);
      console.log(`\n🔔 已發送 Telegram 通知`);
    } else {
      console.log('✅ 所有圖片資源正常！');
    }

  } catch (error) {
    console.error('❌ 檢查過程發生錯誤:', error.message);

    const errorData = {
      timestamp: new Date().toISOString(),
      totalCount: 0,
      successCount: 0,
      errorCount: -1,
      successImages: [],
      errors: [],
      success: false,
      error: error.message,
      url: CONFIG.url,
    };

    saveResults(errorData);

    const errorMessage = `⚠️ *監控系統錯誤*\n\n` +
      `時間: ${new Date().toLocaleString('zh-TW')}\n` +
      `錯誤: ${error.message}`;

    await sendTelegramMessage(errorMessage);
  } finally {
    await browser.close();
    console.log('🔒 瀏覽器已關閉\n');
  }
}

checkWebsite().then(() => {
  console.log('✅ 檢查完成！');
  process.exit(0);
}).catch(err => {
  console.error('❌ 檢查失敗:', err);
  process.exit(1);
});
