// 最簡單的本地測試 - 模仿手動瀏覽器測試成功的方式
require('dotenv').config();
const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testLocal() {
  console.log('🧪 本地測試開始...\n');

  // 🔑 關鍵：使用 headless: false，讓瀏覽器可見
  const browser = await puppeteer.launch({
    headless: false,  // ← 關鍵！讓瀏覽器可見
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // 收集所有圖片
  const allImages = new Set();

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const resourceType = response.request().resourceType();

    if (resourceType === 'image') {
      const fileName = url.split('/').pop();
      allImages.add(url);
      console.log(`✅ 圖片 ${allImages.size}: ${fileName} (HTTP ${status})`);
    }
  });

  try {
    console.log('📡 正在訪問網站...');
    await page.goto(process.env.MONITOR_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待遊戲加載（2.5 分鐘）...');
    await delay(150000);  // 2.5 分鐘

    console.log(`\n📊 結果：共檢測到 ${allImages.size} 個圖片\n`);

    // 列出所有圖片
    const imageList = Array.from(allImages);
    imageList.forEach((url, index) => {
      console.log(`${index + 1}. ${url.split('/').pop()}`);
    });

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  }

  console.log('\n⚠️ 瀏覽器將保持開啟 30 秒，請查看頁面...');
  await delay(30000);

  await browser.close();
  console.log('✅ 測試完成！');
}

testLocal().catch(console.error);
