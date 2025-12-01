# 🤖 GitHub Actions 自動監控指南

完全免費的自動化監控方案！無需服務器，GitHub 自動幫你運行。

## ✨ 特點

- ✅ **完全免費** - 使用 GitHub Actions 免費額度
- ✅ **自動執行** - 每 30 分鐘自動檢查
- ✅ **公開網頁** - GitHub Pages 展示結果
- ✅ **Telegram 通知** - 發現錯誤立即通知
- ✅ **歷史記錄** - 自動保存最近 100 次檢查

## 📋 設置步驟（5 分鐘）

### 步驟 1：設置 GitHub Secrets

1. 打開你的 GitHub 倉庫：https://github.com/dadazax/detect-dealer
2. 點擊 **Settings**（設置）
3. 左側菜單點擊 **Secrets and variables** → **Actions**
4. 點擊 **New repository secret** 添加以下 3 個 secrets：

#### Secret 1: MONITOR_URL
```
名稱: MONITOR_URL
值: http://uat.playacestaging.com:81/forwardGame.do?params=des3jhDLci176gtCZJbRdvdEAtTx26gXp7HeoFkpswjXxQJu9sWfY1h/Poynv/Q8eDLvmfefs3zWb3GhbpuA9G+oCDVivRABrbZIbHchsNEceFq08ETKnHHNWMPZjkdEvHncD6ckm6qvQL8pSM2uWsvEZDlmLZRGY9BqYkam5ecNri6rgfpfY2gTxFTqY2Y8WLzq1ivPebfp6ZIgMTCA3MVzAKa//dA7lelQNKU/LE//9ASRubp6bKjUuQd8oNFgtd8vMF/Apaos+aa5edEvdg==&key=087690ad416fa1d53a202a612021ec0f
```

#### Secret 2: TELEGRAM_BOT_TOKEN
```
名稱: TELEGRAM_BOT_TOKEN
值: 8560545684:AAGL9qVatijZncgixujZSQvZOx5LhSdKplE
```

#### Secret 3: TELEGRAM_CHAT_ID
```
名稱: TELEGRAM_CHAT_ID
值: 7562223705
```

### 步驟 2：啟用 GitHub Pages

1. 在同一個 Settings 頁面
2. 左側菜單點擊 **Pages**
3. 在 **Source** 下拉選單選擇 **Deploy from a branch**
4. 在 **Branch** 選擇 **main** 分支
5. 文件夾選擇 **/docs**
6. 點擊 **Save**

幾分鐘後，你的網頁就會上線！網址類似：
```
https://dadazax.github.io/detect-dealer/
```

### 步驟 3：手動觸發第一次檢查（可選）

1. 點擊 **Actions** 標籤
2. 左側選擇 **Website Monitor** 工作流程
3. 點擊 **Run workflow** 按鈕
4. 選擇 **main** 分支
5. 點擊綠色的 **Run workflow** 按鈕

第一次運行後，就會開始自動執行了！

## 🌐 訪問你的監控網頁

設置完成後，訪問：

```
https://dadazax.github.io/detect-dealer/
```

你會看到：
- 📊 當前監控狀態
- 📈 最後檢查時間
- 📋 最近 20 次檢查記錄
- ❌ 所有發現的錯誤

**頁面每 5 分鐘自動刷新**

## ⏰ 執行時間表

GitHub Actions 會在以下情況執行監控：

1. **定時執行** - 每 30 分鐘自動執行
2. **手動觸發** - 在 Actions 頁面手動運行
3. **推送代碼** - 每次推送到 main 分支（測試用）

## 📱 Telegram 通知

當發現 404 錯誤時，你會立即收到 Telegram 訊息：

```
🚨 網站圖片 404 錯誤警報

🌐 網站: PlayAce 遊戲平台
⏰ 時間: 2025/12/1 下午2:30:00
❌ 發現 1 個圖片無法加載

📋 錯誤清單:

1. M052.jpg
   URL: http://...
```

## 📊 數據存儲

檢查結果保存在 `docs/data/` 目錄：

- `latest.json` - 最新一次檢查結果
- `history.json` - 歷史記錄（最多 100 條）

這些文件會自動提交到 GitHub，你可以查看完整歷史。

## 🔍 查看執行日誌

想查看詳細的執行過程？

1. 打開 GitHub 倉庫
2. 點擊 **Actions** 標籤
3. 點擊任一執行記錄
4. 查看詳細日誌

## ⚙️ 自定義設置

### 修改執行頻率

編輯 `.github/workflows/monitor.yml` 文件的 cron 設置：

```yaml
schedule:
  - cron: '*/30 * * * *'  # 每 30 分鐘
```

常用設置：
- `*/15 * * * *` - 每 15 分鐘
- `*/30 * * * *` - 每 30 分鐘（當前）
- `0 * * * *` - 每小時
- `0 */2 * * *` - 每 2 小時

### 修改保留記錄數

編輯 `check-and-save.js` 第 76 行：

```javascript
if (history.checks.length > 100) {  // 改成你想要的數字
```

## ❓ 常見問題

### Q: GitHub Actions 免費嗎？
A: 是的！公開倉庫完全免費，私有倉庫每月有 2000 分鐘免費額度。

### Q: 為什麼有時會延遲執行？
A: GitHub Actions 在高峰時段可能會延遲幾分鐘，這是正常的。

### Q: 可以添加更多監控網站嗎？
A: 可以！修改 `check-and-save.js` 添加多個 URL 檢查。

### Q: 數據會丟失嗎？
A: 不會！所有數據都提交到 GitHub，永久保存。

### Q: 可以私有化嗎？
A: 可以！將倉庫設為私有，但 GitHub Pages 可能需要付費。

## 🆘 故障排除

### Actions 執行失敗

1. 檢查 Secrets 是否正確設置
2. 查看執行日誌找出錯誤
3. 確認 Telegram Token 有效

### GitHub Pages 無法訪問

1. 確認 Pages 已啟用
2. 確認選擇了 `main` 分支和 `/docs` 目錄
3. 等待 5-10 分鐘讓 GitHub 部署

### 沒有收到 Telegram 通知

1. 確認 Bot Token 和 Chat ID 正確
2. 確認已經和 Bot 發送過訊息
3. 檢查 Actions 日誌是否有錯誤

## 🎯 優勢對比

| 功能 | GitHub Actions | Railway | 本地運行 |
|------|----------------|---------|----------|
| 成本 | ✅ 免費 | 有限免費 | 需要電腦一直開 |
| 維護 | ✅ 零維護 | 需要管理 | 需要管理 |
| 公開訪問 | ✅ GitHub Pages | ✅ 公開 URL | ❌ 僅本地 |
| 自動化 | ✅ 完全自動 | ✅ 自動 | 需要手動 |
| 可靠性 | ✅ 99.9% | 高 | 取決於電腦 |

## 🌟 完成！

設置完成後，你就擁有了：

- 🤖 自動監控系統（每 30 分鐘）
- 🌐 公開網頁展示（GitHub Pages）
- 📱 即時 Telegram 通知
- 📊 歷史數據記錄
- 💯 完全免費！

---

需要幫助？在 GitHub Issues 提問：
https://github.com/dadazax/detect-dealer/issues
