@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ==========================================
echo 不動産動画自動生成システム
echo ==========================================
echo.

if not exist "node_modules" (
    echo [1/5] 依存関係をインストール中...
    call npm install
    echo.
)

echo [2/5] Prisma Client を生成中...
call npx prisma generate

echo.
echo [3/5] データベースを初期化中...
call npx prisma db push

echo.
echo [4/5] サンプルデータを投入中...
call npx tsx prisma/seed.ts 2>nul

echo.
echo [5/5] 開発サーバーを起動中...
echo.
echo ========================================
echo ブラウザで http://localhost:3000 を開いてください
echo ========================================
echo.
call npm run dev

