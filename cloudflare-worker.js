/**
 * Cloudflare Worker - GitHub Actions Trigger Proxy
 *
 * 這個 Worker 作為安全代理，讓公開網站可以觸發 GitHub Actions
 * 而不需要暴露 GitHub token
 */

// CORS 設定
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // 生產環境建議改為你的 GitHub Pages 網址
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// GitHub API 配置
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'dadazax';
const REPO_NAME = 'detect-dealer';
const WORKFLOW_FILE = 'monitor.yml';

/**
 * 處理 OPTIONS 請求 (CORS preflight)
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * 觸發 GitHub Actions workflow
 */
async function triggerWorkflow(env) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Worker-Monitor',
    },
    body: JSON.stringify({
      ref: 'main',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API 錯誤 (${response.status}): ${error}`);
  }

  // GitHub 的 dispatches API 成功時返回 204，不返回 run ID
  // 我們需要等待一下然後查詢最新的運行
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Workflow 已觸發',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    }
  );
}

/**
 * 獲取最新的 workflow 運行
 */
async function getLatestRun(env) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare-Worker-Monitor',
    },
  });

  if (!response.ok) {
    throw new Error(`無法獲取運行列表: ${response.status}`);
  }

  const data = await response.json();

  if (!data.workflow_runs || data.workflow_runs.length === 0) {
    return new Response(
      JSON.stringify({
        error: '沒有找到運行記錄',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      }
    );
  }

  const run = data.workflow_runs[0];

  return new Response(
    JSON.stringify({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      updated_at: run.updated_at,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    }
  );
}

/**
 * 獲取指定 run 的狀態
 */
async function getRunStatus(runId, env) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare-Worker-Monitor',
    },
  });

  if (!response.ok) {
    throw new Error(`無法獲取運行狀態: ${response.status}`);
  }

  const data = await response.json();

  return new Response(
    JSON.stringify({
      id: data.id,
      status: data.status,
      conclusion: data.conclusion,
      created_at: data.created_at,
      updated_at: data.updated_at,
      html_url: data.html_url,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    }
  );
}

/**
 * 主要的請求處理器
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 處理 CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      // POST /trigger - 觸發 workflow
      if (url.pathname === '/trigger' && request.method === 'POST') {
        return await triggerWorkflow(env);
      }

      // GET /latest - 獲取最新運行
      if (url.pathname === '/latest' && request.method === 'GET') {
        return await getLatestRun(env);
      }

      // GET /status/:runId - 獲取指定運行的狀態
      const statusMatch = url.pathname.match(/^\/status\/(\d+)$/);
      if (statusMatch && request.method === 'GET') {
        const runId = statusMatch[1];
        return await getRunStatus(runId, env);
      }

      // 404 - 未知路徑
      return new Response(
        JSON.stringify({
          error: '未找到端點',
          available_endpoints: [
            'POST /trigger - 觸發 workflow',
            'GET /latest - 獲取最新運行',
            'GET /status/:runId - 獲取運行狀態',
          ],
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );

    } catch (error) {
      console.error('Worker 錯誤:', error);

      return new Response(
        JSON.stringify({
          error: error.message || '內部錯誤',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }
  },
};
