@echo off
chcp 65001 > nul
echo ==========================================
echo 不動産動画自動生成システム - 起動
echo ==========================================
echo.
echo 開発サーバーを起動中...
echo ブラウザで http://localhost:3000 を開いてください
echo.
echo Ctrl+C で停止できます
echo.
call npm run dev

