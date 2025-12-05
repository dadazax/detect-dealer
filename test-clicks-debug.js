// 調試版本 - 測試點擊是否有效
require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 測試的點擊座標
const CLICK_POSITIONS = [
  { name: '歐洲廳', x: 80, y: 400 },
  { name: '色碟', x: 80, y: 450 },
  { name: '競咪', x: 80, y: 510 },
];

// 點擊 Canvas
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
      console.log(`已點擊座標: (${x}, ${y})`);
    } else {
      console.log('找不到 Canvas 元素');
    }
  }, x, y);
}

async function testClicks() {
  console.log('\n🧪 點擊測試（調試模式）');
  console.log('='.repeat(60));
  console.log('此模式會在每次點擊後截圖，幫助診斷問題\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // 監聽控制台輸出
  page.on('console', msg => console.log('🖥️  頁面日誌:', msg.text()));

  // 計數圖片
  const allImages = new Set();
  page.on('response', async (response) => {
    const url = response.url();
    const resourceType = response.request().resourceType();

    if (resourceType === 'image') {
      const fileName = url.split('/').pop();
      if (fileName.toLowerCase().endsWith('.jpg')) {
        allImages.add(url);
      }
    }
  });

  try {
    console.log('📡 正在訪問網站...');
    await page.goto(process.env.MONITOR_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待初始頁面加載（30 秒）...');
    await delay(30000);

    // 初始截圖
    const initialScreenshot = path.join(__dirname, 'debug-0-initial.png');
    await page.screenshot({ path: initialScreenshot });
    console.log(`📸 初始截圖已保存: ${initialScreenshot}`);
    console.log(`📊 初始 JPG 圖片數量: ${allImages.size}`);

    // 測試每個點擊
    for (let i = 0; i < CLICK_POSITIONS.length; i++) {
      const position = CLICK_POSITIONS[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📌 測試點擊 ${i + 1}/${CLICK_POSITIONS.length}: ${position.name}`);
      console.log(`   座標: (${position.x}, ${position.y})`);

      // 點擊前的圖片數量
      const beforeCount = allImages.size;
      console.log(`   點擊前圖片數: ${beforeCount}`);

      // 執行點擊
      await clickCanvas(page, position.x, position.y);
      console.log('   ✅ 點擊已執行');

      // 等待反應
      console.log('   ⏳ 等待 3 秒看頁面反應...');
      await delay(3000);

      // 點擊後立即截圖
      const afterClickScreenshot = path.join(__dirname, `debug-${i + 1}-${position.name}-after-click.png`);
      await page.screenshot({ path: afterClickScreenshot });
      console.log(`   📸 點擊後截圖: ${afterClickScreenshot}`);

      // 等待圖片加載
      console.log('   ⏳ 等待 20 秒讓圖片加載...');
      await delay(20000);

      // 最終截圖
      const finalScreenshot = path.join(__dirname, `debug-${i + 1}-${position.name}-final.png`);
      await page.screenshot({ path: finalScreenshot });
      console.log(`   📸 最終截圖: ${finalScreenshot}`);

      // 點擊後的圖片數量
      const afterCount = allImages.size;
      console.log(`   點擊後圖片數: ${afterCount}`);
      console.log(`   新增圖片數: ${afterCount - beforeCount}`);

      if (afterCount === beforeCount) {
        console.log('   ⚠️  警告：圖片數量沒有增加！');
      } else {
        console.log('   ✅ 檢測到新圖片');
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 測試總結');
    console.log('='.repeat(60));
    console.log(`總共收集到 ${allImages.size} 張 JPG 圖片`);
    console.log('\n📸 所有截圖已保存到專案目錄');
    console.log('請檢查截圖，確認：');
    console.log('1. 點擊是否真的切換了廳別');
    console.log('2. 頁面是否有載入新內容');
    console.log('3. 座標位置是否正確');

    console.log('\n⏳ 瀏覽器將保持開啟 30 秒，請查看...');
    await delay(30000);

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ 測試完成！');
  }
}

testClicks().catch(console.error);
