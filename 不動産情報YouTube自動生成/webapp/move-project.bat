@echo off
chcp 65001 > nul
echo ==========================================
echo プロジェクトを英語パスに移動
echo ==========================================
echo.

set SOURCE=%~dp0
set DEST=C:\Projects\real-estate-video

echo 移動元: %SOURCE%
echo 移動先: %DEST%
echo.

if not exist "C:\Projects" mkdir "C:\Projects"

echo ファイルをコピー中...
xcopy "%SOURCE%*" "%DEST%\" /E /I /H /Y

echo.
echo ==========================================
echo 完了！
echo ==========================================
echo.
echo 新しい場所: %DEST%
echo.
echo Cursorで以下のフォルダを開いてください:
echo C:\Projects\real-estate-video
echo.
pause

