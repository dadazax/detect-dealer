// 本地運行檢測並自動推送結果到 GitHub
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  // 方法 1：使用 Puppeteer 的原生點擊（推薦）
  await page.mouse.click(x, y);

  // 短暫延遲讓事件處理
  await new Promise(resolve => setTimeout(resolve, 500));
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
        execSync('sleep 5', { cwd: __dirname });
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

    if (CLICK_POSITIONS.length > 0) {
      console.log('\n🎯 開始點擊不同的廳，收集所有圖片...\n');

      // 依次點擊每個分類
      for (const position of CLICK_POSITIONS) {
        console.log(`📌 點擊：${position.name} (${position.x}, ${position.y})`);

        await clickCanvas(page, position.x, position.y);

        // 等待該分類的圖片加載
        console.log(`⏳ 等待 ${position.name} 的圖片加載...`);
        await delay(20000);  // 每個分類等待 20 秒

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

    if (errorCount === 0) {
      console.log('\n✅ 所有圖片資源正常！');
    } else {
      console.log(`\n⚠️ 發現 ${errorCount} 個圖片 404 錯誤`);
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
