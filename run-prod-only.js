// 本地運行檢測 PROD 環境並自動推送結果到 GitHub
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
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
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
          console.error(`回應內容: ${responseData}`);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
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
  { name: '歐洲廳', x: 80, y: 400, scroll: true },
  // 色碟已跳過，不需要檢查
  { name: '競咪', x: 80, y: 510, scroll: false },  // 競咪不需要向下滾動
];

// 點擊 Canvas 上的座標
async function clickCanvas(page, x, y) {
  await page.mouse.click(x, y);
  await new Promise(resolve => setTimeout(resolve, 500));
}

// 增強版滾動函數 - 確保滾動到底部加載所有圖片
async function scrollToLoadImages(page, shouldScroll = true) {
  if (!shouldScroll) {
    console.log('   ⏭️  跳過滾動');
    return;
  }

  console.log('   📜 開始滾動遊戲畫面加載隱藏的圖片...');

  // 移動滑鼠到遊戲中心位置
  await page.mouse.move(960, 540);

  // 向下滾動 20 次（增加滾動次數以確保到底）
  for (let i = 0; i < 20; i++) {
    console.log(`   ⬇️  向下滾動 (${i + 1}/20)...`);
    await page.mouse.wheel({ deltaY: 600 });  // 增加滾動距離
    await delay(1500);  // 增加等待時間讓圖片加載
  }

  console.log('   ⏳ 等待圖片完全加載...');
  await delay(5000);  // 增加最終等待時間

  // 向上滾動回頂部
  for (let i = 0; i < 20; i++) {
    console.log(`   ⬆️  向上滾動 (${i + 1}/20)...`);
    await page.mouse.wheel({ deltaY: -600 });
    await delay(500);
  }

  console.log('   ✅ 滾動完成');
}

function saveResults(data) {
  const dataDir = path.join(__dirname, 'docs', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 保存到 PROD 專用文件
  const latestProdFile = path.join(dataDir, 'latest-prod.json');
  fs.writeFileSync(latestProdFile, JSON.stringify(data, null, 2));

  const historyProdFile = path.join(dataDir, 'history-prod.json');
  let historyProd = { checks: [] };

  if (fs.existsSync(historyProdFile)) {
    try {
      historyProd = JSON.parse(fs.readFileSync(historyProdFile, 'utf8'));
    } catch (error) {
      console.error('讀取 PROD 歷史記錄失敗:', error.message);
    }
  }

  historyProd.checks.unshift(data);
  if (historyProd.checks.length > 100) {
    historyProd.checks = historyProd.checks.slice(0, 100);
  }
  fs.writeFileSync(historyProdFile, JSON.stringify(historyProd, null, 2));

  // 同時保存到主文件（latest.json）- 使用向後兼容的單環境格式
  const latestFile = path.join(dataDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(data, null, 2));

  // 更新主歷史記錄
  const historyFile = path.join(dataDir, 'history.json');
  let history = { checks: [] };

  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (error) {
      console.error('讀取主歷史記錄失敗:', error.message);
    }
  }

  history.checks.unshift(data);
  if (history.checks.length > 100) {
    history.checks = history.checks.slice(0, 100);
  }
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

  console.log('✅ 結果已保存到：');
  console.log('   - latest-prod.json / history-prod.json (PROD 專用)');
  console.log('   - latest.json / history.json (網頁顯示)');
}

function gitPush() {
  try {
    console.log('\n📤 推送到 GitHub...');

    // 檢測 Git 命令
    let gitCmd = 'git';
    try {
      execSync('git --version', { cwd: __dirname, stdio: 'ignore' });
    } catch (err) {
      console.log('⚠️ 未找到 git 命令，嘗試使用 Git Bash...');
      const gitBashPaths = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        'C:\\Users\\dada.ho.REVO\\Desktop\\cmder\\vendor\\git-for-windows\\bin\\bash.exe',
      ];

      let gitBashFound = false;
      for (const bashPath of gitBashPaths) {
        if (fs.existsSync(bashPath)) {
          gitCmd = `"${bashPath}" -c`;
          gitBashFound = true;
          console.log(`✅ 找到 Git Bash: ${bashPath}`);
          break;
        }
      }

      if (!gitBashFound) {
        console.error('❌ 找不到 Git 或 Git Bash，跳過推送');
        return;
      }
    }

    // 執行 Git 命令的輔助函數
    const runGit = (cmd) => {
      if (gitCmd.includes('bash')) {
        return execSync(`${gitCmd} "cd '${__dirname.replace(/\\/g, '/')}' && ${cmd}"`, { stdio: 'inherit' });
      } else {
        return execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
      }
    };

    // 添加所有數據文件變更
    runGit('git add docs/data/');

    // 檢查是否有變更
    try {
      if (gitCmd.includes('bash')) {
        execSync(`${gitCmd} "cd '${__dirname.replace(/\\/g, '/')}' && git diff --quiet && git diff --staged --quiet"`);
      } else {
        execSync('git diff --quiet && git diff --staged --quiet', { cwd: __dirname });
      }
      console.log('沒有變更需要提交');
      return;
    } catch (err) {
      // 有變更，繼續
    }

    // 提交
    const timestamp = new Date().toLocaleString('zh-TW');
    runGit(`git commit -m "PROD 環境檢測結果 - ${timestamp}"`);

    // 推送到 GitLab（最多重試 3 次）
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`嘗試推送到 GitLab (第 ${i} 次)...`);

        // 先嘗試 rebase，如果失敗則用 merge
        try {
          runGit('git pull origin main:master --rebase');
        } catch (rebaseErr) {
          console.log('⚠️ Rebase 失敗，改用 merge 方式...');
          runGit('git rebase --abort');
          runGit('git pull origin main:master --no-rebase');
        }

        runGit('git push origin main:master');
        console.log('✅ GitLab 推送成功！');
        break;
      } catch (err) {
        if (i === 3) {
          console.error('❌ GitLab 推送失敗');
          throw err;
        }
        console.log('GitLab 推送失敗，等待 5 秒後重試...');
        const start = Date.now();
        while (Date.now() - start < 5000) {}
      }
    }

    // 推送到 GitHub（用於 Pages）
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`嘗試推送到 GitHub (第 ${i} 次)...`);

        // 先拉取 GitHub 的更新
        try {
          runGit('git pull github main --rebase');
        } catch (pullErr) {
          console.log('⚠️ GitHub pull 失敗，可能是首次推送或沒有衝突');
          try {
            runGit('git rebase --abort');
          } catch (e) {
            // ignore
          }
        }

        runGit('git push github main');
        console.log('✅ GitHub 推送成功！');
        return;
      } catch (err) {
        if (i === 3) {
          console.error('❌ GitHub 推送失敗（不影響主要功能）');
          console.error(err.message);
          return; // 不拋出錯誤，因為 GitHub 是次要的
        }
        console.log('GitHub 推送失敗，等待 5 秒後重試...');
        const start = Date.now();
        while (Date.now() - start < 5000) {}
      }
    }
  } catch (error) {
    console.error('❌ Git 操作失敗:', error.message);
  }
}

async function runCheck() {
  console.log('\n' + '='.repeat(60));
  console.log(`🔍 PROD 環境檢測開始: ${new Date().toLocaleString('zh-TW')}`);
  console.log('='.repeat(60) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
    ],
    protocolTimeout: 180000,  // 增加協議超時至 180 秒
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
    console.log('📡 正在訪問 PROD 環境...');
    await page.goto(process.env.MONITOR_URL_PROD, {
      waitUntil: 'networkidle2',
      timeout: 90000,
    });

    console.log('⏳ 等待初始頁面加載（90 秒）...');
    await delay(90000);

    // 先滾動初始頁面（卡卡灣廳 - 預設廳別）
    console.log('\n📜 滾動初始頁面（卡卡灣廳）...');
    await scrollToLoadImages(page, true);
    console.log(`   當前已收集 ${allImages.size} 張 JPG 圖片`);
    await delay(10000);

    if (CLICK_POSITIONS.length > 0) {
      console.log('\n🎯 開始點擊不同的廳，收集所有圖片...\n');

      for (const position of CLICK_POSITIONS) {
        console.log(`📌 點擊：${position.name} (${position.x}, ${position.y})`);

        await clickCanvas(page, position.x, position.y);

        console.log(`⏳ 等待 ${position.name} 的頁面載入...`);
        await delay(5000);

        // 根據配置決定是否滾動
        await scrollToLoadImages(page, position.scroll);

        console.log(`   ⏳ 等待圖片完全加載...`);
        await delay(15000);  // 增加等待時間

        console.log(`✅ ${position.name} 完成，當前已收集 ${allImages.size} 張 JPG 圖片\n`);
      }
    }

    console.log('⏳ 最後確認所有資源...');
    await delay(15000);

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
      environment: 'PROD',
      totalCount: totalCount,
      successCount: successCount,
      errorCount: errorCount,
      successImages: successList,
      errors: errors,
      success: errorCount === 0,
      url: process.env.MONITOR_URL_PROD,
      source: 'local',
    };

    // 保存結果
    saveResults(resultData);

    // 推送到 GitHub
    gitPush();

    // 發送 Telegram 通知
    const timestamp = new Date().toLocaleString('zh-TW');
    let telegramMessage = `🔍 <b>PROD 環境監控報告</b>\n`;
    telegramMessage += `⏰ 時間: ${timestamp}\n`;
    telegramMessage += `📊 檢查了 ${totalCount} 張圖片\n`;
    telegramMessage += `✅ 正常: ${successCount} 張\n`;

    if (errorCount === 0) {
      telegramMessage += `\n✅ 所有圖片資源正常！`;
      console.log('\n✅ 所有圖片資源正常！');
    } else {
      // 按檔名去重並過濾排除的檔案
      const uniqueErrors = [];
      const seenFileNames = new Set();
      errors.forEach(err => {
        // 排除 test*.jpg 和 Training.jpg
        if (err.fileName.toLowerCase().startsWith('test') && err.fileName.toLowerCase().endsWith('.jpg')) {
          return; // 跳過 test*.jpg
        }
        if (err.fileName.toLowerCase() === 'training.jpg') {
          return; // 跳過 Training.jpg
        }

        if (!seenFileNames.has(err.fileName)) {
          seenFileNames.add(err.fileName);
          uniqueErrors.push(err);
        }
      });

      if (uniqueErrors.length === 0) {
        telegramMessage += `\n✅ 所有重要圖片資源正常！`;
        console.log('\n✅ 所有重要圖片資源正常（已忽略測試檔案）');
      } else {
        telegramMessage += `❌ 錯誤: ${uniqueErrors.length} 張（去重且過濾後）\n\n`;
        telegramMessage += `⚠️ <b>發現問題圖片：</b>\n`;
        uniqueErrors.slice(0, 10).forEach((err, idx) => {
          telegramMessage += `${idx + 1}. ${err.fileName}\n`;
        });
        if (uniqueErrors.length > 10) {
          telegramMessage += `... 及其他 ${uniqueErrors.length - 10} 張\n`;
        }
        console.log(`\n⚠️ 發現 ${errorCount} 個圖片 404 錯誤（${uniqueErrors.length} 個重要檔案，已排除測試檔）`);
      }
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
      environment: 'PROD',
      totalCount: 0,
      successCount: 0,
      errorCount: -1,
      successImages: [],
      errors: [],
      success: false,
      error: error.message,
      url: process.env.MONITOR_URL_PROD,
      source: 'local',
    };

    saveResults(errorData);
    gitPush();

    const timestamp = new Date().toLocaleString('zh-TW');
    const telegramMessage = `❌ <b>PROD 環境監控失敗</b>\n⏰ 時間: ${timestamp}\n\n錯誤訊息: ${error.message}`;
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
