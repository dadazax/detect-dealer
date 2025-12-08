// 本地運行檢測（支持多環境）並自動推送結果到 GitHub
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 環境配置
const ENVIRONMENTS = [
  { name: 'UAT', url: process.env.MONITOR_URL_UAT },
  { name: 'PROD', url: process.env.MONITOR_URL_PROD },
];

// 點擊座標 - 左側的廳別
const CLICK_POSITIONS = [
  { name: '歐洲廳', x: 80, y: 400, scroll: true },
  // 色碟已跳過，不需要檢查
  { name: '競咪', x: 80, y: 510, scroll: false },  // 競咪不需要向下滾動
];

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

// 點擊 Canvas
async function clickCanvas(page, x, y) {
  await page.mouse.click(x, y);
  await new Promise(resolve => setTimeout(resolve, 500));
}

// 使用滑鼠滾輪滾動
async function scrollToLoadImages(page) {
  console.log('   📜 開始滾動遊戲畫面加載隱藏的圖片...');

  await page.mouse.move(960, 540);

  for (let i = 0; i < 10; i++) {
    console.log(`   ⬇️  向下滾動 (${i + 1}/10)...`);
    await page.mouse.wheel({ deltaY: 500 });
    await delay(1000);
  }

  console.log('   ⏳ 等待圖片加載...');
  await delay(3000);

  for (let i = 0; i < 10; i++) {
    console.log(`   ⬆️  向上滾動 (${i + 1}/10)...`);
    await page.mouse.wheel({ deltaY: -500 });
    await delay(500);
  }

  console.log('   ✅ 滾動完成');
}

// 保存單個環境的結果
function saveEnvironmentResults(envName, data) {
  const dataDir = path.join(__dirname, 'docs', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 保存該環境的最新結果
  const latestFile = path.join(dataDir, `latest-${envName.toLowerCase()}.json`);
  fs.writeFileSync(latestFile, JSON.stringify(data, null, 2));

  // 保存該環境的歷史記錄
  const historyFile = path.join(dataDir, `history-${envName.toLowerCase()}.json`);
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
  console.log(`✅ ${envName} 結果已保存`);
}

// 檢測單個環境
async function checkEnvironment(envName, url) {
  console.log('\n' + '='.repeat(60));
  console.log(`🔍 開始檢測 ${envName} 環境`);
  console.log(`🌐 URL: ${url.substring(0, 50)}...`);
  console.log('='.repeat(60) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
    ],
    protocolTimeout: 120000,  // 增加協議超時時間至 120 秒
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
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待初始頁面加載（1 分鐘）...');
    await delay(60000);

    console.log('\n📜 滾動初始頁面（卡卡灣廳）...');
    await scrollToLoadImages(page);
    console.log(`   當前已收集 ${allImages.size} 張 JPG 圖片`);
    await delay(5000);

    if (CLICK_POSITIONS.length > 0) {
      console.log('\n🎯 開始點擊不同的廳，收集所有圖片...\n');

      for (const position of CLICK_POSITIONS) {
        console.log(`📌 點擊：${position.name} (${position.x}, ${position.y})`);
        await clickCanvas(page, position.x, position.y);

        console.log(`⏳ 等待 ${position.name} 的頁面載入...`);
        await delay(3000);

        if (position.scroll) {
          console.log(`   📜 ${position.name} 需要滾動加載圖片`);
          await scrollToLoadImages(page);
        } else {
          console.log(`   ⚡ ${position.name} 跳過滾動（優化速度）`);
        }

        console.log(`   ⏳ 等待圖片完全加載...`);
        await delay(10000);

        console.log(`✅ ${position.name} 完成，當前已收集 ${allImages.size} 張 JPG 圖片\n`);
      }
    }

    console.log('⏳ 最後確認所有資源...');
    await delay(10000);

    const errorCount = failed404Images.size;
    const successCount = successImages.size;
    const totalCount = allImages.size;
    const errors = Array.from(failed404Images.values());
    const successList = Array.from(successImages.values());

    console.log(`\n📊 ${envName} 檢查完成！`);
    console.log(`總共檢查 ${totalCount} 個圖片`);
    console.log(`✅ 正常: ${successCount} 個`);
    console.log(`❌ 錯誤: ${errorCount} 個`);

    const resultData = {
      environment: envName,
      timestamp: new Date().toISOString(),
      totalCount: totalCount,
      successCount: successCount,
      errorCount: errorCount,
      successImages: successList,
      errors: errors,
      success: errorCount === 0,
      url: url,
      source: 'local',
    };

    saveEnvironmentResults(envName, resultData);

    await browser.close();
    console.log(`🔒 ${envName} 瀏覽器已關閉\n`);

    return resultData;

  } catch (error) {
    console.error(`❌ ${envName} 檢查過程發生錯誤:`, error.message);

    const errorData = {
      environment: envName,
      timestamp: new Date().toISOString(),
      totalCount: 0,
      successCount: 0,
      errorCount: -1,
      successImages: [],
      errors: [],
      success: false,
      error: error.message,
      url: url,
      source: 'local',
    };

    saveEnvironmentResults(envName, errorData);
    await browser.close();

    return errorData;
  }
}

// Git 推送
function gitPush() {
  try {
    console.log('\n📤 推送到 GitHub...');

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

    const runGit = (cmd) => {
      if (gitCmd.includes('bash')) {
        return execSync(`${gitCmd} "cd '${__dirname.replace(/\\/g, '/')}' && ${cmd}"`, { stdio: 'inherit' });
      } else {
        return execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
      }
    };

    runGit('git add docs/data/');

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

    const timestamp = new Date().toLocaleString('zh-TW');
    runGit(`git commit -m "多環境檢測結果 - ${timestamp}"`);

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`嘗試推送 (第 ${i} 次)...`);

        // 先嘗試 rebase，如果失敗則用 merge
        try {
          runGit('git pull --rebase');
        } catch (rebaseErr) {
          console.log('⚠️ Rebase 失敗，改用 merge 方式...');
          runGit('git rebase --abort');  // 取消失敗的 rebase
          runGit('git pull --no-rebase');  // 使用 merge
        }

        runGit('git push');
        console.log('✅ 推送成功！');
        return;
      } catch (err) {
        if (i === 3) {
          console.error('❌ 推送失敗（已重試 3 次）');
          console.error('錯誤詳情:', err.message);
          throw err;
        }
        console.log('推送失敗，等待 5 秒後重試...');
        const start = Date.now();
        while (Date.now() - start < 5000) {}
      }
    }
  } catch (error) {
    console.error('❌ Git 操作失敗:', error.message);
  }
}

// 主函數
async function runAllChecks() {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 多環境檢測開始: ${new Date().toLocaleString('zh-TW')}`);
  console.log('='.repeat(60));

  const results = [];

  // 依次檢測每個環境
  for (const env of ENVIRONMENTS) {
    if (!env.url) {
      console.log(`⚠️ 跳過 ${env.name}：未配置 URL`);
      continue;
    }

    try {
      const result = await checkEnvironment(env.name, env.url);
      results.push(result);
    } catch (error) {
      console.error(`❌ ${env.name} 檢測失敗:`, error.message);
      results.push({
        environment: env.name,
        success: false,
        error: error.message,
      });
    }
  }

  // 保存總結果
  const dataDir = path.join(__dirname, 'docs', 'data');
  const summaryFile = path.join(dataDir, 'latest.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    environments: results,
  }, null, 2));
  console.log('✅ 總結果已保存');

  // 推送到 GitHub
  gitPush();

  // 發送 Telegram 通知
  const timestamp = new Date().toLocaleString('zh-TW');
  let telegramMessage = `🔍 <b>網站監控報告（多環境）</b>\n`;
  telegramMessage += `⏰ 時間: ${timestamp}\n\n`;

  for (const result of results) {
    if (!result.environment) continue;

    telegramMessage += `━━━━━━━━━━━━━━━━\n`;
    telegramMessage += `<b>📍 ${result.environment} 環境</b>\n\n`;

    // errorCount === -1 表示檢測失敗，>= 0 表示檢測成功
    if (result.errorCount >= 0) {
      telegramMessage += `📊 檢查圖片: ${result.totalCount} 張\n`;
      telegramMessage += `✅ 正常: ${result.successCount} 張\n`;

      if (result.errorCount === 0) {
        telegramMessage += `\n✨ 所有圖片資源正常！\n`;
      } else {
        telegramMessage += `❌ 錯誤: ${result.errorCount} 張\n\n`;
        telegramMessage += `<b>⚠️ 錯誤圖片列表：</b>\n`;
        result.errors.forEach((err, idx) => {
          telegramMessage += `${idx + 1}. ${err.fileName}\n`;
          telegramMessage += `   └ HTTP ${err.status}\n`;
        });
      }
    } else {
      telegramMessage += `❌ 檢測失敗: ${result.error || '未知錯誤'}\n`;
    }
    telegramMessage += `\n`;
  }

  telegramMessage += `🔗 查看詳情: https://dadazax.github.io/detect-dealer/`;

  try {
    await sendTelegramNotification(telegramMessage);
  } catch (error) {
    console.error('❌ Telegram 通知發送失敗');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有環境檢測完成！');
  console.log('='.repeat(60));
}

runAllChecks().then(() => {
  console.log('\n✅ 程序執行完成！');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ 程序執行失敗:', err);
  process.exit(1);
});
