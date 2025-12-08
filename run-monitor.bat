@echo off
REM 自動運行網站監控（多環境）並推送結果

echo ========================================
echo 網站監控 - 本地運行（UAT + PROD）
echo ========================================
echo.

cd /d "%~dp0"

REM 檢查 Git 是否在 PATH 中
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  警告：Git 未找到，嘗試使用 Git Bash...

    REM 嘗試常見的 Git Bash 路徑
    if exist "C:\Program Files\Git\bin\bash.exe" (
        "C:\Program Files\Git\bin\bash.exe" -c "cd '%CD%' && node run-multi-env.js"
    ) else if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
        "C:\Program Files (x86)\Git\bin\bash.exe" -c "cd '%CD%' && node run-multi-env.js"
    ) else (
        echo ❌ 錯誤：找不到 Git 或 Git Bash
        echo 請手動在 Git Bash 中運行: node run-multi-env.js
        pause
        exit /b 1
    )
) else (
    REM Git 在 PATH 中，直接運行
    node run-multi-env.js
)

echo.
echo ========================================
echo 完成！
echo ========================================

REM 如果需要查看結果，取消下面這行的註解
REM pause
