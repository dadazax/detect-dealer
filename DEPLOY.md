# 🚀 部署指南 - Railway.app

這份指南將教你如何將監控系統部署到 Railway，讓它可以在公開網址上運行，任何人都可以訪問。

## 為什麼選擇 Railway？

- ✅ **完全免費**（每月 $5 免費額度）
- ✅ **支持 Puppeteer**（需要的無頭瀏覽器）
- ✅ **自動部署**（推送到 GitHub 自動更新）
- ✅ **提供公開網址**（https://your-app.railway.app）
- ✅ **簡單易用**（幾分鐘內完成設置）

## 📋 部署步驟

### 1. 註冊 Railway 賬號

1. 訪問：https://railway.app
2. 點擊 "Start a New Project"
3. 使用 GitHub 賬號登錄（推薦）

### 2. 創建新項目

1. 登錄後，點擊 "New Project"
2. 選擇 "Deploy from GitHub repo"
3. 選擇你的倉庫：`dadazax/detect-dealer`
4. Railway 會自動檢測到 Dockerfile 並開始構建

### 3. 設置環境變數

部署後，你需要在 Railway 中設置環境變數：

1. 點擊你的項目
2. 選擇 "Variables" 標籤
3. 添加以下環境變數：

```
MONITOR_URL=http://uat.playacestaging.com:81/forwardGame.do?params=des3jhDLci176gtCZJbRdvdEAtTx26gXp7HeoFkpswjXxQJu9sWfY1h/Poynv/Q8eDLvmfefs3zWb3GhbpuA9G+oCDVivRABrbZIbHchsNEceFq08ETKnHHNWMPZjkdEvHncD6ckm6qvQL8pSM2uWsvEZDlmLZRGY9BqYkam5ecNri6rgfpfY2gTxFTqY2Y8WLzq1ivPebfp6ZIgMTCA3MVzAKa//dA7lelQNKU/LE//9ASRubp6bKjUuQd8oNFgtd8vMF/Apaos+aa5edEvdg==&key=087690ad416fa1d53a202a612021ec0f

TELEGRAM_BOT_TOKEN=8560545684:AAGL9qVatijZncgixujZSQvZOx5LhSdKplE

TELEGRAM_CHAT_ID=7562223705

HEADLESS=true
```

### 4. 獲取公開網址

1. 部署完成後，點擊 "Settings" 標籤
2. 找到 "Domains" 部分
3. 點擊 "Generate Domain"
4. Railway 會生成一個公開網址，例如：`https://detect-dealer-production.up.railway.app`

### 5. 訪問你的儀表板

打開生成的網址，你就可以看到公開的監控儀表板了！

## 🔄 自動部署

設置完成後，每次你推送代碼到 GitHub 的 main 分支，Railway 都會自動：
1. 檢測到更新
2. 重新構建 Docker 鏡像
3. 部署新版本
4. 無需手動操作！

## 📱 使用公開網址

部署後，任何人都可以通過你的 Railway 網址訪問儀表板：

- 查看監控狀態
- 查看錯誤記錄
- 手動觸發檢查
- 查看統計數據

## 🔒 安全建議

### 選項 1：添加簡單的密碼保護

如果你想保護儀表板不被未授權訪問，可以添加環境變數：

```
AUTH_PASSWORD=your_secret_password
```

然後修改 `web-server.js` 添加簡單的驗證。

### 選項 2：使用 Railway 的私有網絡

Railway 也支持私有部署，只有你可以訪問。

## 🎯 其他部署選項

如果 Railway 不符合需求，還有其他選擇：

### Render.com
- 免費額度
- 支持 Docker
- 網址：https://render.com

### Fly.io
- 免費額度
- 全球 CDN
- 網址：https://fly.io

### Vercel（需修改代碼）
- 免費
- 但需要改為 Serverless 架構
- 網址：https://vercel.com

## ❓ 常見問題

### Q: Railway 免費額度夠用嗎？
A: 每月 $5 額度，對於輕量級監控完全足夠。

### Q: 如何查看部署日誌？
A: 在 Railway 項目中點擊 "Deployments" 可以查看所有日誌。

### Q: 如何停止或刪除部署？
A: 在項目設置中可以暫停或刪除服務。

### Q: Puppeteer 會正常運行嗎？
A: 是的！Dockerfile 已經包含所有必要的依賴。

## 🆘 需要幫助？

- Railway 文檔：https://docs.railway.app
- GitHub Issues：https://github.com/dadazax/detect-dealer/issues

---

部署成功後，你就擁有一個 24/7 運行的公開監控系統了！🎉
