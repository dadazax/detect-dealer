// 輔助腳本 - 找出廳別的點擊座標
require('dotenv').config();
const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findCoordinates() {
  console.log('\n📍 座標尋找工具');
  console.log('='.repeat(60));
  console.log('此工具會打開瀏覽器，幫你找出廳別按鈕的點擊座標\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // 注入點擊監聽器
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('click', (e) => {
      console.log(`點擊座標: X=${e.clientX}, Y=${e.clientY}`);

      // 在頁面上顯示座標
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.top = '10px';
      div.style.left = '10px';
      div.style.background = 'rgba(0, 0, 0, 0.8)';
      div.style.color = 'lime';
      div.style.padding = '10px';
      div.style.fontFamily = 'monospace';
      div.style.fontSize = '14px';
      div.style.zIndex = '999999';
      div.style.borderRadius = '5px';
      div.innerHTML = `
        <div style="margin-bottom: 5px; font-weight: bold;">🎯 點擊座標</div>
        <div>X: ${e.clientX}</div>
        <div>Y: ${e.clientY}</div>
        <div style="margin-top: 10px; font-size: 12px; color: yellow;">
          複製此座標：{ x: ${e.clientX}, y: ${e.clientY} }
        </div>
      `;

      // 移除舊的提示
      const old = document.querySelector('#coord-display');
      if (old) old.remove();
      div.id = 'coord-display';

      document.body.appendChild(div);

      // 3 秒後淡出
      setTimeout(() => {
        div.style.transition = 'opacity 0.5s';
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 500);
      }, 3000);
    }, true);
  });

  try {
    console.log('📡 正在訪問網站...');
    await page.goto(process.env.MONITOR_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待遊戲加載（30 秒）...\n');
    await delay(30000);

    console.log('✅ 遊戲已加載！');
    console.log('\n' + '='.repeat(60));
    console.log('📋 使用說明：');
    console.log('1. 在瀏覽器中點擊左側的各個「廳別」按鈕');
    console.log('2. 每次點擊都會在畫面左上角顯示座標');
    console.log('3. 同時也會在此終端顯示座標');
    console.log('4. 記錄每個廳別的座標');
    console.log('5. 完成後關閉瀏覽器或按 Ctrl+C\n');
    console.log('範例廳別：歐洲廳、卡卡灣廳、色碟、競咪等');
    console.log('='.repeat(60) + '\n');

    // 監聽控制台輸出
    page.on('console', msg => {
      if (msg.text().includes('點擊座標')) {
        console.log('🎯 ' + msg.text());
      }
    });

    // 保持瀏覽器開啟，直到用戶關閉
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    await browser.close();
  }
}

findCoordinates().catch(console.error);
