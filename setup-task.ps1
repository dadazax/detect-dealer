# 自動設置 Windows 任務計劃程序 - 每小時運行一次
# 需要以管理員權限運行

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "網站監控 - 自動任務設置" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查是否以管理員權限運行
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  需要管理員權限！" -ForegroundColor Yellow
    Write-Host "請右鍵點擊此腳本 → 選擇「以系統管理員身分執行」" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 任務設定
$taskName = "網站監控-每小時"
$scriptPath = Join-Path $PSScriptRoot "run-monitor.bat"
$workingDir = $PSScriptRoot

Write-Host "📋 任務設定：" -ForegroundColor Green
Write-Host "   名稱：$taskName"
Write-Host "   腳本：$scriptPath"
Write-Host "   工作目錄：$workingDir"
Write-Host "   頻率：每小時一次"
Write-Host ""

# 檢查腳本是否存在
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ 找不到 run-monitor.bat" -ForegroundColor Red
    Write-Host "   請確認檔案存在：$scriptPath" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 刪除舊任務（如果存在）
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "🗑️  刪除舊任務..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# 創建觸發器 - 每小時一次
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# 創建動作
$action = New-ScheduledTaskAction -Execute $scriptPath -WorkingDirectory $workingDir

# 創建設定
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# 創建主體（以當前用戶運行）
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# 註冊任務
Write-Host "🔧 正在創建任務..." -ForegroundColor Cyan
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Trigger $trigger `
        -Action $action `
        -Settings $settings `
        -Principal $principal `
        -Description "每小時檢查網站圖片是否正常" | Out-Null

    Write-Host ""
    Write-Host "✅ 任務創建成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "📊 任務資訊" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "名稱：$taskName"
    Write-Host "頻率：每小時一次"
    Write-Host "下次運行：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host "狀態：已啟用"
    Write-Host ""
    Write-Host "📋 管理任務：" -ForegroundColor Yellow
    Write-Host "   - 打開任務計劃程序：按 Win+R，輸入 taskschd.msc"
    Write-Host "   - 查看任務：在左側找到「$taskName」"
    Write-Host "   - 手動運行：右鍵點擊任務 → 執行"
    Write-Host "   - 停用任務：右鍵點擊任務 → 停用"
    Write-Host "   - 刪除任務：右鍵點擊任務 → 刪除"
    Write-Host ""

    # 詢問是否立即運行一次
    Write-Host "🚀 是否立即運行一次測試？(Y/N)" -ForegroundColor Cyan
    $runNow = Read-Host

    if ($runNow -eq "Y" -or $runNow -eq "y") {
        Write-Host ""
        Write-Host "🔄 正在運行任務..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $taskName
        Write-Host "✅ 任務已觸發！請查看瀏覽器視窗。" -ForegroundColor Green
    }

} catch {
    Write-Host ""
    Write-Host "❌ 創建任務失敗：$($_.Exception.Message)" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host ""
Write-Host "✅ 設置完成！" -ForegroundColor Green
Write-Host ""
Read-Host "按 Enter 鍵退出"
