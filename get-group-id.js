// 獲取 Telegram 群組 Chat ID
require('dotenv').config();
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('❌ 錯誤：未設置 TELEGRAM_BOT_TOKEN');
  console.log('請在 .env 文件中設置 TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

console.log('🔍 正在獲取群組 Chat ID...\n');

https.get(`https://api.telegram.org/bot${botToken}/getUpdates`, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const updates = JSON.parse(data);

      if (!updates.ok) {
        console.error('❌ API 錯誤:', updates.description);
        return;
      }

      if (!updates.result || updates.result.length === 0) {
        console.log('❌ 沒有找到任何對話\n');
        console.log('請確認：');
        console.log('1. 機器人已加入群組');
        console.log('2. 在群組裡發送過訊息（例如：/start 或任意文字）');
        console.log('3. TELEGRAM_BOT_TOKEN 設定正確');
        return;
      }

      console.log('📋 最近的對話列表：\n');
      console.log('='.repeat(60));

      const chats = new Map();

      updates.result.forEach(update => {
        const chat = update.message?.chat || update.my_chat_member?.chat;
        if (chat) {
          chats.set(chat.id, {
            id: chat.id,
            type: chat.type,
            title: chat.title || chat.first_name || '未命名',
          });
        }
      });

      chats.forEach(chat => {
        let typeLabel = '';
        if (chat.type === 'group' || chat.type === 'supergroup') {
          typeLabel = '📢 群組';
        } else if (chat.type === 'private') {
          typeLabel = '👤 個人';
        } else {
          typeLabel = '📱 ' + chat.type;
        }

        console.log(`${typeLabel}: ${chat.title}`);
        console.log(`   Chat ID: ${chat.id}`);
        console.log(`   類型: ${chat.type}`);
        console.log('');
      });

      console.log('='.repeat(60));
      console.log('\n💡 使用說明：\n');
      console.log('1. 找到你要的群組');
      console.log('2. 複製該群組的 Chat ID（通常是負數，例如 -1001234567890）');
      console.log('3. 更新 .env 文件：');
      console.log('   TELEGRAM_CHAT_ID=你的群組Chat ID');
      console.log('\n4. 如果沒看到你的群組：');
      console.log('   - 確認機器人已加入群組');
      console.log('   - 在群組裡發一條訊息');
      console.log('   - 重新運行此腳本');

    } catch (error) {
      console.error('❌ 解析錯誤:', error.message);
    }
  });
}).on('error', (err) => {
  console.error('❌ 網絡錯誤:', err.message);
});
