# PlayAce 網站圖片監控系統

自動監控 PlayAce 遊戲網站的圖片資源，當發現 404 錯誤時自動發送 Telegram 通知。

## 功能特點

### 監控功能
- ✅ 自動訪問網站並檢查所有圖片資源
- ✅ 模擬點擊各個標籤以觸發懶加載資源
- ✅ 檢測 HTTP 404 錯誤
- ✅ 發送詳細的 Telegram 通知
- ✅ 定時自動執行（每 30 分鐘）
- ✅ 支持測試模式

### Web 儀表板
- 🌐 美觀的 Web 界面
- 📊 即時監控狀態顯示
- 📈 24小時統計數據
- 📋 檢查歷史記錄
- 🔍 手動觸發檢查
- 🔄 自動刷新數據

## 安裝步驟

### 1. 安裝 Node.js

確保你的系統已安裝 Node.js（建議 v16 或更高版本）

### 2. 安裝依賴

```bash
cd website-monitor
npm install
```

### 3. 設置 Telegram Bot

#### 3.1 創建 Telegram Bot

1. 打開 Telegram，搜索 `@BotFather`
2. 發送 `/newbot` 命令
3. 按照提示設置 Bot 名稱和用戶名
4. 獲取你的 **Bot Token**（類似：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`）

#### 3.2 獲取 Chat ID

1. 搜索並開啟你剛創建的 Bot
2. 發送任意訊息給 Bot
3. 在瀏覽器訪問：
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. 在返回的 JSON 中找到 `"chat":{"id":123456789}`，這就是你的 **Chat ID**

### 4. 配置環境變數

複製 `.env.example` 並重命名為 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 文件，填入你的配置：

```env
MONITOR_URL=http://uat.playacestaging.com:81/forwardGame.do?params=...
TELEGRAM_BOT_TOKEN=你的_Bot_Token
TELEGRAM_CHAT_ID=你的_Chat_ID
HEADLESS=true
```

## 使用方法

### 方式 1：Web 儀表板（推薦）

啟動 Web 界面來監控和管理：

```bash
npm run web
```

或雙擊 `start-web.bat`

然後在瀏覽器訪問：http://localhost:3000

Web 儀表板功能：
- 查看即時監控狀態
- 查看歷史檢查記錄
- 手動觸發檢查
- 查看統計數據

### 方式 2：測試模式（執行一次）

在正式啟動前，建議先測試一次：

```bash
npm test
```

或

```bash
node monitor.js --test
```

### 方式 3：啟動監控（定時執行）

```bash
npm start
```

監控系統會：
- 立即執行一次檢查
- 每 30 分鐘自動執行一次
- 持續運行直到手動停止（按 Ctrl+C）

### 使用 PM2 保持後台運行（推薦）

安裝 PM2：

```bash
npm install -g pm2
```

啟動監控：

```bash
pm2 start monitor.js --name "website-monitor"
```

查看狀態：

```bash
pm2 status
```

查看日誌：

```bash
pm2 logs website-monitor
```

停止監控：

```bash
pm2 stop website-monitor
```

開機自動啟動：

```bash
pm2 startup
pm2 save
```

## Telegram 通知範例

當發現 404 錯誤時，你會收到類似以下的訊息：

```
🚨 網站圖片 404 錯誤警報

🌐 網站: PlayAce 遊戲平台
⏰ 時間: 2025/12/1 下午3:30:00
❌ 發現 1 個圖片無法加載

📋 錯誤清單:

1. M052.jpg
   URL: http://uat.playacestaging.com:81/pc/pcv1/images/dealer/MS4/M052.jpg
```

## 調整檢查頻率

編輯 `monitor.js` 第 13 行：

```javascript
cronSchedule: '*/30 * * * *', // 每 30 分鐘
```

常用的 cron 表達式：

- `*/5 * * * *` - 每 5 分鐘
- `*/15 * * * *` - 每 15 分鐘
- `0 * * * *` - 每小時
- `0 */2 * * *` - 每 2 小時
- `0 9 * * *` - 每天早上 9:00

## 故障排除

### 問題：收不到 Telegram 通知

1. 確認 Bot Token 和 Chat ID 正確
2. 確認已經對 Bot 發送過至少一次訊息
3. 檢查網絡連接

### 問題：Puppeteer 安裝失敗

Windows 用戶可能需要：

```bash
npm install --ignore-scripts
npx puppeteer browsers install chrome
```

### 問題：監控一直失敗

1. 檢查網站 URL 是否正確
2. 確認網絡可以訪問目標網站
3. 使用測試模式並查看錯誤訊息

## 文件結構

```
website-monitor/
├── monitor.js          # 主程序
├── package.json        # 依賴配置
├── .env               # 環境變數（需要自己創建）
├── .env.example       # 環境變數範例
└── README.md          # 說明文檔
```

## 技術棧

- Node.js
- Puppeteer（無頭瀏覽器）
- node-cron（定時任務）
- node-telegram-bot-api（Telegram 通知）
- dotenv（環境變數管理）

## License

MIT
