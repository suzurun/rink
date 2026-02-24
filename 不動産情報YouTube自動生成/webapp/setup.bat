@echo off
chcp 65001 > nul
echo ==========================================
echo 不動産動画自動生成システム - セットアップ
echo ==========================================
echo.

echo [1/4] 依存関係のインストール...
call npm install

echo.
echo [2/4] Prisma Client の生成...
call npx prisma generate

echo.
echo [3/4] データベースの初期化...
call npx prisma db push

echo.
echo [4/4] サンプルデータの投入...
call npm run db:seed

echo.
echo ==========================================
echo セットアップ完了！
echo ==========================================
echo.
echo 開発サーバーを起動するには:
echo   npm run dev
echo.
echo ブラウザで http://localhost:3000 を開いてください
echo.
pause

