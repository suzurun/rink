@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ==========================================
echo GitHub 自動アップロード
echo ==========================================
echo.

echo [1/6] Git 初期化...
git init
if errorlevel 1 goto :error

echo.
echo [2/6] .gitignore 確認...

echo.
echo [3/6] 全ファイルを追加...
git add .
if errorlevel 1 goto :error

echo.
echo [4/6] コミット作成...
git commit -m "Initial commit: 不動産動画自動生成システム"
if errorlevel 1 goto :error

echo.
echo [5/6] ブランチ名を main に変更...
git branch -M main
if errorlevel 1 goto :error

echo.
echo ==========================================
echo Git ローカル設定完了！
echo ==========================================
echo.
echo 次に GitHub でリポジトリを作成してください:
echo.
echo 1. ブラウザで https://github.com/new を開く
echo 2. Repository name: real-estate-video-generator
echo 3. Create repository をクリック
echo 4. 作成したら、このウィンドウに戻ってEnterを押す
echo.
pause

set /p USERNAME="GitHubユーザー名を入力: "

echo.
echo [6/6] GitHubにプッシュ...
git remote add origin https://github.com/%USERNAME%/real-estate-video-generator.git
git push -u origin main

echo.
echo ==========================================
echo 完了！
echo https://github.com/%USERNAME%/real-estate-video-generator
echo ==========================================
pause
goto :end

:error
echo.
echo エラーが発生しました
pause

:end

