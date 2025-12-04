# ☁️ Cloudflare Workers 設置指南

使用 Cloudflare Workers 作為安全代理，讓所有用戶都能使用「立即檢查」功能，而不需要每個人都創建 GitHub token。

## 🎯 優勢

- ✅ **完全免費** - Cloudflare Workers 免費版每天 100,000 次請求
- ✅ **安全** - GitHub token 安全存儲在 Cloudflare 環境變量中
- ✅ **簡單** - 用戶無需配置，直接點擊即可使用
- ✅ **快速** - 全球邊緣網絡，低延遲
- ✅ **無需服務器** - Serverless 架構，零維護

## 📋 設置步驟（10 分鐘）

### 步驟 1：註冊 Cloudflare 帳號

1. 訪問 [Cloudflare Workers](https://workers.cloudflare.com/)
2. 點擊 **Sign Up** 註冊免費帳號
3. 驗證郵箱

### 步驟 2：創建 Worker

1. 登入後，點擊左側菜單 **Workers & Pages**
2. 點擊右上角 **Create application**
3. 選擇 **Create Worker**
4. 名稱輸入：`github-monitor-proxy`（或任何你喜歡的名稱）
5. 點擊 **Deploy** 創建 Worker

### 步驟 3：上傳 Worker 代碼

1. Worker 創建後，點擊 **Quick Edit** 或 **Edit Code**
2. 刪除示例代碼
3. 複製 `cloudflare-worker.js` 的所有內容
4. 貼上到編輯器中
5. 點擊 **Save and Deploy**

### 步驟 4：設置環境變量（重要！）

1. 回到 Worker 頁面，點擊 **Settings** 標籤
2. 找到 **Variables** 部分
3. 點擊 **Add variable**
4. 添加以下變量：

#### 變量設定

```
名稱: GITHUB_TOKEN
類型: 選擇 "Encrypt" (加密)
值: [你的 GitHub Personal Access Token]
```

5. 點擊 **Save and Deploy**

⚠️ **重要**：選擇 "Encrypt" 確保 token 安全加密存儲

### 步驟 5：獲取 Worker URL

1. 回到 Worker 主頁
2. 你會看到 Worker URL，類似：
   ```
   https://github-monitor-proxy.<your-subdomain>.workers.dev
   ```
3. **複製這個 URL**，稍後需要用到

### 步驟 6：測試 Worker（可選）

使用瀏覽器或 curl 測試：

```bash
# 測試觸發端點
curl -X POST https://github-monitor-proxy.<your-subdomain>.workers.dev/trigger

# 測試狀態端點
curl https://github-monitor-proxy.<your-subdomain>.workers.dev/latest
```

如果返回 JSON 數據，說明 Worker 正常工作！

### 步驟 7：更新網站代碼

現在需要更新 `docs/index.html` 來使用 Cloudflare Worker 而不是直接調用 GitHub API。

編輯 `docs/index.html`，找到 `triggerManualCheck` 函數，替換為：

```javascript
async function triggerManualCheck() {
    const btn = document.getElementById('checkBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 觸發中...';

    const progressContainer = document.getElementById('progressContainer');
    progressContainer.style.display = 'block';

    // 替換為你的 Cloudflare Worker URL
    const WORKER_URL = 'https://github-monitor-proxy.<your-subdomain>.workers.dev';

    try {
        updateProgress(10, '正在觸發檢查...');

        // 調用 Cloudflare Worker 而不是直接調用 GitHub API
        const response = await fetch(`${WORKER_URL}/trigger`, {
            method: 'POST'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '觸發失敗');
        }

        updateProgress(30, '檢查已觸發，等待開始...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 獲取最新運行
        const latestResponse = await fetch(`${WORKER_URL}/latest`);
        const latestData = await latestResponse.json();

        if (latestData.error) {
            throw new Error(latestData.error);
        }

        const runId = latestData.id;
        updateProgress(40, '檢查正在執行中...');

        // 監控進度
        await monitorProgressViaWorker(WORKER_URL, runId);
        updateProgress(100, '✅ 檢查完成！');

        setTimeout(() => {
            loadData();
            progressContainer.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error('Error:', error);
        updateProgress(0, `❌ 錯誤: ${error.message}`);
        alert(`❌ 檢查失敗\n\n${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 立即檢查';
    }
}

async function monitorProgressViaWorker(workerUrl, runId) {
    let progress = 40;
    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(`${workerUrl}/status/${runId}`);
        const run = await response.json();

        if (run.status === 'completed') {
            if (run.conclusion === 'success') {
                return;
            } else {
                throw new Error(`檢查失敗: ${run.conclusion}`);
            }
        }

        progress = Math.min(90, 40 + (i / maxAttempts) * 50);
        updateProgress(Math.floor(progress), `執行中... (${Math.floor(i * 2 / 60)}分${(i * 2) % 60}秒)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('檢查超時');
}
```

**記得替換 `<your-subdomain>` 為你實際的 Worker URL！**

### 步驟 8：提交並推送更改

```bash
cd website-monitor
git add docs/index.html cloudflare-worker.js CLOUDFLARE-SETUP.md
git commit -m "Add Cloudflare Workers proxy for secure GitHub Actions trigger"
git push
```

幾分鐘後，GitHub Pages 會自動更新。

### 步驟 9：移除 Token 設置 UI（可選）

現在用戶不需要自己配置 token 了，可以移除設置界面：

1. 編輯 `docs/index.html`
2. 刪除或隱藏 Settings 按鈕和彈窗相關代碼
3. 簡化 UI

## 🧪 測試

1. 訪問你的 GitHub Pages：`https://dadazax.github.io/detect-dealer/`
2. 點擊 **🔍 立即檢查** 按鈕
3. 應該會看到進度條顯示檢查進度
4. 檢查完成後，頁面會自動刷新顯示結果

## 📊 API 端點

你的 Cloudflare Worker 提供以下 API：

### POST /trigger
觸發 GitHub Actions workflow

**請求：**
```bash
curl -X POST https://your-worker.workers.dev/trigger
```

**響應：**
```json
{
  "success": true,
  "message": "Workflow 已觸發",
  "timestamp": "2025-12-04T10:30:00.000Z"
}
```

### GET /latest
獲取最新的 workflow 運行

**請求：**
```bash
curl https://your-worker.workers.dev/latest
```

**響應：**
```json
{
  "id": 12345678,
  "status": "in_progress",
  "conclusion": null,
  "created_at": "2025-12-04T10:30:00Z",
  "updated_at": "2025-12-04T10:31:00Z"
}
```

### GET /status/:runId
獲取指定運行的狀態

**請求：**
```bash
curl https://your-worker.workers.dev/status/12345678
```

**響應：**
```json
{
  "id": 12345678,
  "status": "completed",
  "conclusion": "success",
  "created_at": "2025-12-04T10:30:00Z",
  "updated_at": "2025-12-04T10:35:00Z",
  "html_url": "https://github.com/dadazax/detect-dealer/actions/runs/12345678"
}
```

## 🔒 安全性

### CORS 設置（生產環境建議）

編輯 `cloudflare-worker.js` 第 11 行：

```javascript
// 開發環境 - 允許所有來源
'Access-Control-Allow-Origin': '*',

// 生產環境 - 只允許你的 GitHub Pages
'Access-Control-Allow-Origin': 'https://dadazax.github.io',
```

### 速率限制（可選）

如果擔心被濫用，可以添加速率限制。在 Worker 中添加：

```javascript
// 使用 Cloudflare KV 存儲請求計數
const RATE_LIMIT = 10; // 每分鐘最多 10 次請求

async function checkRateLimit(ip, env) {
  const key = `ratelimit:${ip}`;
  const count = await env.KV.get(key) || 0;

  if (count >= RATE_LIMIT) {
    throw new Error('請求過於頻繁，請稍後再試');
  }

  await env.KV.put(key, parseInt(count) + 1, { expirationTtl: 60 });
}
```

## ❓ 常見問題

### Q: Cloudflare Workers 真的免費嗎？
A: 是的！免費版每天 100,000 次請求，對於監控系統完全足夠。

### Q: Worker URL 可以自定義嗎？
A: 可以！在 Cloudflare 控制台的 Worker 設置中可以添加自定義域名。

### Q: 如果 Worker 出錯怎麼辦？
A: 可以在 Cloudflare 控制台的 **Logs** 標籤查看詳細錯誤日誌。

### Q: 可以更新 Worker 代碼嗎？
A: 可以！隨時在 Quick Edit 中修改代碼並重新部署。

### Q: GitHub token 會被洩露嗎？
A: 不會！Token 加密存儲在 Cloudflare 環境變量中，不會出現在任何響應中。

## 🎉 完成！

設置完成後，你就擁有了：

- ☁️ 安全的 Cloudflare Worker 代理
- 🔒 加密的 GitHub token 存儲
- 🚀 全球邊緣網絡加速
- 👥 所有用戶都能直接使用立即檢查功能
- 💯 完全免費！

---

需要幫助？查看：
- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [GitHub Issues](https://github.com/dadazax/detect-dealer/issues)
