// 測試發送訊息到 Telegram 群組
require('dotenv').config();
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('🧪 測試 Telegram 群組訊息發送\n');
console.log('='.repeat(60));
console.log(`Bot Token: ${botToken ? botToken.substring(0, 10) + '...' : '未設置'}`);
console.log(`Chat ID: ${chatId}`);
console.log('='.repeat(60) + '\n');

if (!botToken || !chatId) {
  console.error('❌ 錯誤：未設置 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID');
  process.exit(1);
}

const message = `🧪 <b>測試訊息</b>

這是一條測試訊息，用來確認機器人可以在群組中發送訊息。

⏰ 時間: ${new Date().toLocaleString('zh-TW')}
📍 Chat ID: ${chatId}

如果你看到這條訊息，表示設定成功！✅`;

const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
const data = JSON.stringify({
  chat_id: chatId,
  text: message,
  parse_mode: 'HTML',
});

console.log('📤 正在發送測試訊息到群組...\n');

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
    console.log(`HTTP 狀態碼: ${res.statusCode}\n`);

    if (res.statusCode === 200) {
      console.log('✅ 測試訊息發送成功！');
      console.log('\n請檢查你的 Telegram 群組，應該會看到測試訊息。');
      console.log('\n' + '='.repeat(60));
      console.log('🎉 設定完成！現在監控結果會發送到群組了！');
      console.log('='.repeat(60));
    } else {
      console.error('❌ 發送失敗！\n');
      const response = JSON.parse(responseData);
      console.error('錯誤詳情:', response);

      if (response.description) {
        console.log('\n可能的原因：');
        if (response.description.includes('chat not found')) {
          console.log('- Chat ID 錯誤或機器人沒有加入該群組');
        } else if (response.description.includes('bot was blocked')) {
          console.log('- 機器人被封鎖');
        } else if (response.description.includes('bot was kicked')) {
          console.log('- 機器人被踢出群組');
        } else {
          console.log('- ' + response.description);
        }
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 網絡錯誤:', error.message);
});

req.write(data);
req.end();
