require('dotenv').config();
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');

// 配置
const CONFIG = {
  url: process.env.MONITOR_URL,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  cronSchedule: '*/30 * * * *', // 每 30 分鐘執行一次
  headless: process.env.HEADLESS !== 'false', // 默認無頭模式
};

// 初始化 Telegram Bot
const bot = new TelegramBot(CONFIG.telegramToken, { polling: false });

// 點擊座標配置
const CLICK_POSITIONS = [
  { name: '歐廳', x: 189, y: 218 },
  { name: '百家樂', x: 265, y: 218 },
  { name: '競速', x: 341, y: 218 },
  { name: '龍虎', x: 416, y: 218 },
  { name: '21點', x: 492, y: 218 },
  { name: '歐利廳', x: 33, y: 360 },
];

// 發送 Telegram 訊息
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

// 在 Canvas 上模擬點擊
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

// 等待延遲
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 主要監控函數
async function checkWebsite() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 開始檢查網站: ${new Date().toLocaleString('zh-TW')}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  const failed404Images = new Map(); // 使用 Map 來去重

  // 監聽所有網絡請求
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const resourceType = response.request().resourceType();

    // 只關注圖片資源的 404 錯誤
    if (resourceType === 'image' && status === 404) {
      const fileName = url.split('/').pop();
      if (!failed404Images.has(url)) {
        failed404Images.set(url, {
          url,
          fileName,
          status,
        });
        console.log(`❌ 發現 404 圖片: ${fileName}`);
      }
    }
  });

  try {
    console.log('📡 正在訪問網站...');
    await page.goto(CONFIG.url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待初始資源加載...');
    await delay(5000);

    // 點擊各個標籤來觸發懶加載
    console.log('🖱️ 開始點擊各個標籤觸發懶加載...');
    for (const position of CLICK_POSITIONS) {
      console.log(`  ➤ 點擊: ${position.name}`);
      await clickCanvas(page, position.x, position.y);
      await delay(2000); // 等待資源加載
    }

    console.log('⏳ 等待所有資源加載完成...');
    await delay(3000);

    // 檢查結果
    const errorCount = failed404Images.size;
    console.log(`\n📊 檢查完成！`);
    console.log(`總共發現 ${errorCount} 個 404 錯誤的圖片`);

    if (errorCount > 0) {
      // 發送 Telegram 通知
      let message = `🚨 *網站圖片 404 錯誤警報*\n\n`;
      message += `🌐 網站: PlayAce 遊戲平台\n`;
      message += `⏰ 時間: ${new Date().toLocaleString('zh-TW')}\n`;
      message += `❌ 發現 ${errorCount} 個圖片無法加載\n\n`;
      message += `📋 *錯誤清單:*\n`;

      Array.from(failed404Images.values()).forEach((error, index) => {
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

    // 發送錯誤通知
    const errorMessage = `⚠️ *監控系統錯誤*\n\n` +
      `時間: ${new Date().toLocaleString('zh-TW')}\n` +
      `錯誤: ${error.message}`;

    await sendTelegramMessage(errorMessage);
  } finally {
    await browser.close();
    console.log('🔒 瀏覽器已關閉\n');
  }
}

// 測試模式 - 立即執行一次
if (process.argv.includes('--test')) {
  console.log('🧪 測試模式：執行單次檢查...\n');
  checkWebsite().then(() => {
    console.log('✅ 測試完成！');
    process.exit(0);
  }).catch(err => {
    console.error('❌ 測試失敗:', err);
    process.exit(1);
  });
} else {
  // 正式模式 - 定時執行
  console.log('🚀 監控系統啟動');
  console.log(`📅 執行排程: 每 30 分鐘檢查一次`);
  console.log(`🌐 監控網站: ${CONFIG.url}`);
  console.log(`📱 Telegram Chat ID: ${CONFIG.telegramChatId}`);
  console.log('-'.repeat(60));

  // 立即執行一次
  checkWebsite();

  // 設定定時任務
  cron.schedule(CONFIG.cronSchedule, () => {
    checkWebsite();
  });

  console.log('✅ 定時任務已設定');
  console.log('💡 提示: 按 Ctrl+C 停止監控\n');
}
