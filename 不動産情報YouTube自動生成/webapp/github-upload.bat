@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ==========================================
echo GitHub アップロード
echo ==========================================
echo.

echo [1/5] Git 初期化...
git init

echo.
echo [2/5] ファイルを追加...
git add .

echo.
echo [3/5] コミット作成...
git commit -m "Initial commit: 不動産動画自動生成システム"

echo.
echo [4/5] ブランチ名を main に変更...
git branch -M main

echo.
echo ==========================================
echo 次の手順を実行してください:
echo ==========================================
echo.
echo 1. https://github.com/new にアクセス
echo.
echo 2. Repository name に以下を入力:
echo    real-estate-video-generator
echo.
echo 3. Create repository をクリック
echo.
echo 4. 作成後、以下のコマンドを実行:
echo.
echo    git remote add origin https://github.com/あなたのユーザー名/real-estate-video-generator.git
echo    git push -u origin main
echo.
echo ==========================================
pause

