# 🚀 Cloudflare Workers 快速入門

## ⚡ 5 分鐘快速設置

### 你需要做的事：

1. **註冊 Cloudflare 帳號**（如果還沒有）
   - 訪問 https://workers.cloudflare.com/
   - 點擊 Sign Up 註冊免費帳號

2. **創建 Worker**
   - 登入後，點擊 **Workers & Pages** → **Create application**
   - 選擇 **Create Worker**
   - 名稱：`github-monitor-proxy`
   - 點擊 **Deploy**

3. **上傳代碼**
   - 點擊 **Quick Edit**
   - 刪除示例代碼
   - 複製 `cloudflare-worker.js` 的所有內容並貼上
   - 點擊 **Save and Deploy**

4. **設置環境變量**（重要！）
   - 點擊 **Settings** 標籤
   - 找到 **Variables** 部分
   - 點擊 **Add variable**
   - 添加：
     ```
     名稱: GITHUB_TOKEN
     類型: Encrypt（加密）
     值: [你的 GitHub Token]
     ```
   - 點擊 **Save and Deploy**

5. **獲取 Worker URL**
   - 回到 Worker 主頁
   - 複製 URL（類似 `https://github-monitor-proxy.你的子域名.workers.dev`）

6. **更新網站配置**
   - 編輯 `docs/index.html`
   - 找到第 624 行：
     ```javascript
     const DEFAULT_WORKER_URL = 'YOUR_WORKER_URL_HERE';
     ```
   - 替換為你的 Worker URL：
     ```javascript
     const DEFAULT_WORKER_URL = 'https://github-monitor-proxy.你的子域名.workers.dev';
     ```

7. **提交並推送**
   ```bash
   git add docs/index.html cloudflare-worker.js CLOUDFLARE-SETUP.md CLOUDFLARE-QUICKSTART.md
   git commit -m "Add Cloudflare Workers for secure token management"
   git push
   ```

8. **完成！**
   - 等待 1-2 分鐘讓 GitHub Pages 更新
   - 訪問你的網站：https://dadazax.github.io/detect-dealer/
   - 點擊 **🔍 立即檢查** 按鈕測試

## ✅ 成功標誌

如果設置成功：
- 點擊「立即檢查」按鈕後，進度條會顯示
- 不會提示需要設定 Token 或 Worker URL
- 2-4 分鐘後檢查完成，頁面自動刷新顯示結果

## ❌ 常見問題

### Worker 返回 500 錯誤
- 檢查環境變量 `GITHUB_TOKEN` 是否正確設定
- 確認選擇了 "Encrypt" 選項

### 提示「Worker URL 尚未設定」
- 確認已更新 `docs/index.html` 第 624 行
- 確認已經 git push 到 GitHub

### 進度條卡住不動
- 檢查 GitHub Actions 是否正常運行
- 訪問 https://github.com/dadazax/detect-dealer/actions 查看日誌

## 📚 詳細文檔

完整設置說明請查看：
- [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md) - 詳細設置指南
- [GITHUB-ACTIONS.md](GITHUB-ACTIONS.md) - GitHub Actions 配置

---

需要幫助？
- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [GitHub Issues](https://github.com/dadazax/detect-dealer/issues)
