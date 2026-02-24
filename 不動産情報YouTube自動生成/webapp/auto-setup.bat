@echo off
chcp 65001 > nul
echo ==========================================
echo 不動産動画自動生成システム - 自動セットアップ
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/4] Prisma Client の生成...
call npx prisma generate
if errorlevel 1 (
    echo エラー: Prisma generateに失敗しました
    pause
    exit /b 1
)

echo.
echo [2/4] データベースの初期化...
call npx prisma db push
if errorlevel 1 (
    echo エラー: Prisma db pushに失敗しました
    pause
    exit /b 1
)

echo.
echo [3/4] サンプルデータの投入...
call npx tsx prisma/seed.ts
echo.

echo [4/4] 開発サーバーを起動中...
echo.
echo ブラウザで http://localhost:3000 を開いてください
echo Ctrl+C で停止できます
echo.
call npm run dev

