// 測試 Telegram 中文訊息
require('dotenv').config();
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const message = '🔍 測試中文訊息\n✅ 正常: 95 張\n❌ 錯誤: 10 張';

const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
const data = JSON.stringify({
  chat_id: chatId,
  text: message,
  parse_mode: 'HTML',
});

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
    console.log('狀態碼:', res.statusCode);
    console.log('回應:', responseData);
    if (res.statusCode === 200) {
      console.log('✅ 成功！');
    } else {
      console.log('❌ 失敗');
    }
  });
});

req.on('error', (error) => {
  console.error('錯誤:', error.message);
});

req.write(data);
req.end();
