@echo off
echo ========================================
echo PlayAce 網站監控系統 - 測試模式
echo ========================================
echo.

REM 檢查是否已安裝依賴
if not exist "node_modules\" (
    echo [安裝] 正在安裝依賴...
    call npm install
    echo.
)

REM 檢查 .env 文件是否存在
if not exist ".env" (
    echo [警告] 找不到 .env 文件！
    echo [提示] 請複製 .env.example 為 .env 並填入你的配置
    echo.
    pause
    exit /b 1
)

echo [測試] 執行單次檢查...
echo.
node monitor.js --test

pause
