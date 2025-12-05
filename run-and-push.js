// 本地運行檢測並自動推送結果到 GitHub
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 發送 Telegram 通知
async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('⚠️ 未設置 Telegram 配置，跳過通知');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(url, options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Telegram 通知已發送');
          resolve(responseData);
        } else {
          console.error(`❌ Telegram 通知失敗: ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Telegram 通知發送錯誤:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// 點擊座標 - 左側的廳別
const CLICK_POSITIONS = [
  { name: '歐洲廳', x: 80, y: 400 },
  { name: '色碟', x: 80, y: 450 },
  { name: '競咪', x: 80, y: 510 },
  // 如果有其他廳別，可以繼續添加（每個相隔約 50-60 像素）
  // { name: '卡卡灣廳', x: 80, y: 350 },  // 範例
];

// 點擊 Canvas 上的座標 - 使用完整的滑鼠事件序列
async function clickCanvas(page, x, y) {
  // 使用 Puppeteer 的原生點擊
  await page.mouse.click(x, y);

  // 短暫延遲讓事件處理
  await new Promise(resolve => setTimeout(resolve, 500));
}

// 使用滑鼠滾輪滾動 Canvas 遊戲
async function scrollToLoadImages(page) {
  console.log('   📜 開始滾動遊戲畫面加載隱藏的圖片...');

  // 先移動滑鼠到遊戲中心位置
  await page.mouse.move(960, 540);

  // 向下滾動多次（模擬滑鼠滾輪）
  for (let i = 0; i < 10; i++) {
    console.log(`   ⬇️  向下滾動 (${i + 1}/10)...`);
    await page.mouse.wheel({ deltaY: 500 }); // 向下滾動
    await delay(1000); // 每次滾動後等待 1 秒讓圖片加載
  }

  console.log('   ⏳ 等待圖片加載...');
  await delay(3000);

  // 向上滾動回頂部
  for (let i = 0; i < 10; i++) {
    console.log(`   ⬆️  向上滾動 (${i + 1}/10)...`);
    await page.mouse.wheel({ deltaY: -500 }); // 向上滾動
    await delay(500);
  }

  console.log('   ✅ 滾動完成');
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

function gitPush() {
  try {
    console.log('\n📤 推送到 GitHub...');

    // 添加變更
    execSync('git add docs/data/', { cwd: __dirname, stdio: 'inherit' });

    // 檢查是否有變更
    try {
      execSync('git diff --quiet && git diff --staged --quiet', { cwd: __dirname });
      console.log('沒有變更需要提交');
      return;
    } catch (err) {
      // 有變更，繼續
    }

    // 提交
    const timestamp = new Date().toLocaleString('zh-TW');
    execSync(`git commit -m "本地檢測結果 - ${timestamp}"`, { cwd: __dirname, stdio: 'inherit' });

    // 推送（最多重試 3 次）
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`嘗試推送 (第 ${i} 次)...`);
        execSync('git pull --rebase', { cwd: __dirname, stdio: 'inherit' });
        execSync('git push', { cwd: __dirname, stdio: 'inherit' });
        console.log('✅ 推送成功！');
        return;
      } catch (err) {
        if (i === 3) {
          console.error('❌ 推送失敗');
          throw err;
        }
        console.log('推送失敗，等待 5 秒後重試...');
        // 使用同步方式延遲（因為 Windows cmd 沒有 sleep 命令）
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // 空循環等待 5 秒
        }
      }
    }
  } catch (error) {
    console.error('❌ Git 操作失敗:', error.message);
  }
}

async function runCheck() {
  console.log('\n' + '='.repeat(60));
  console.log(`🔍 本地檢測開始: ${new Date().toLocaleString('zh-TW')}`);
  console.log('='.repeat(60) + '\n');

  const browser = await puppeteer.launch({
    headless: false,  // 非 headless 模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const failed404Images = new Map();
  const successImages = new Map();
  const allImages = new Map();

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const resourceType = response.request().resourceType();

    if (resourceType === 'image') {
      const fileName = url.split('/').pop();

      // 只檢查 .jpg 檔案
      if (!fileName.toLowerCase().endsWith('.jpg')) {
        return;
      }

      const imageInfo = {
        url,
        fileName,
        status,
      };

      if (!allImages.has(url)) {
        allImages.set(url, imageInfo);
      }

      if (status === 404) {
        if (!failed404Images.has(url)) {
          failed404Images.set(url, imageInfo);
          console.log(`❌ 發現 404 圖片: ${fileName}`);
        }
      } else if (status === 200 || status === 304) {
        if (!successImages.has(url)) {
          successImages.set(url, imageInfo);
          console.log(`✅ 正常圖片: ${fileName} (HTTP ${status})`);
        }
      }
    }
  });

  try {
    console.log('📡 正在訪問網站...');
    await page.goto(process.env.MONITOR_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待初始頁面加載（1 分鐘）...');
    await delay(60000);  // 等待初始頁面完全加載

    // 先滾動一次初始頁面（卡卡灣廳 - 預設廳別）
    console.log('\n📜 滾動初始頁面（卡卡灣廳）...');
    await scrollToLoadImages(page);
    console.log(`   當前已收集 ${allImages.size} 張 JPG 圖片`);
    await delay(5000);  // 等待圖片加載

    if (CLICK_POSITIONS.length > 0) {
      console.log('\n🎯 開始點擊不同的廳，收集所有圖片...\n');

      // 依次點擊每個分類
      for (const position of CLICK_POSITIONS) {
        console.log(`📌 點擊：${position.name} (${position.x}, ${position.y})`);

        await clickCanvas(page, position.x, position.y);

        // 等待該分類的圖片開始加載
        console.log(`⏳ 等待 ${position.name} 的頁面載入...`);
        await delay(3000);  // 等待頁面切換

        // 滾動頁面以加載所有圖片
        await scrollToLoadImages(page);

        // 再等待一下讓圖片加載完成
        console.log(`   ⏳ 等待圖片完全加載...`);
        await delay(10000);

        console.log(`✅ ${position.name} 完成，當前已收集 ${allImages.size} 張 JPG 圖片\n`);
      }
    } else {
      console.log('📋 未設定廳別點擊座標，只檢測初始頁面的圖片');
    }

    console.log('⏳ 最後確認所有資源...');
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
      url: process.env.MONITOR_URL,
      source: 'local',  // 標記為本地運行
    };

    // 保存結果
    saveResults(resultData);

    // 推送到 GitHub
    gitPush();

    // 發送 Telegram 通知
    const timestamp = new Date().toLocaleString('zh-TW');
    let telegramMessage = `🔍 <b>網站監控報告</b>\n`;
    telegramMessage += `⏰ 時間: ${timestamp}\n`;
    telegramMessage += `📊 檢查了 ${totalCount} 張圖片\n`;
    telegramMessage += `✅ 正常: ${successCount} 張\n`;

    if (errorCount === 0) {
      telegramMessage += `\n✅ 所有圖片資源正常！`;
      console.log('\n✅ 所有圖片資源正常！');
    } else {
      telegramMessage += `❌ 錯誤: ${errorCount} 張\n\n`;
      telegramMessage += `⚠️ <b>發現問題圖片：</b>\n`;
      errors.slice(0, 10).forEach((err, idx) => {
        telegramMessage += `${idx + 1}. ${err.fileName}\n`;
      });
      if (errorCount > 10) {
        telegramMessage += `... 及其他 ${errorCount - 10} 張\n`;
      }
      console.log(`\n⚠️ 發現 ${errorCount} 個圖片 404 錯誤`);
    }

    telegramMessage += `\n🔗 查看詳情: https://dadazax.github.io/detect-dealer/`;

    try {
      await sendTelegramNotification(telegramMessage);
    } catch (error) {
      console.error('❌ Telegram 通知發送失敗，但檢查已完成');
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
      url: process.env.MONITOR_URL,
      source: 'local',
    };

    saveResults(errorData);
    gitPush();

    // 發送錯誤通知到 Telegram
    const timestamp = new Date().toLocaleString('zh-TW');
    const telegramMessage = `❌ <b>網站監控失敗</b>\n⏰ 時間: ${timestamp}\n\n錯誤訊息: ${error.message}`;
    try {
      await sendTelegramNotification(telegramMessage);
    } catch (e) {
      console.error('❌ Telegram 通知發送失敗');
    }
  } finally {
    await browser.close();
    console.log('🔒 瀏覽器已關閉\n');
  }
}

runCheck().then(() => {
  console.log('✅ 檢查完成！');
  process.exit(0);
}).catch(err => {
  console.error('❌ 檢查失敗:', err);
  process.exit(1);
});
