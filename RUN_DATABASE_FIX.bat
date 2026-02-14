@echo off
echo ==========================================
echo      OPENING DATABASE FIX TOOL
echo ==========================================
echo.
echo 1. I am copying the fix code to your clipboard...
type "FIX_DAILY_UPLOAD_ERROR.sql" | clip
echo [OK] Code copied!
echo.
echo 2. Opening Supabase SQL Editor in your browser...
start https://supabase.com/dashboard/project/jkahwsflhgsfotgvkckw/sql/new
echo.
echo ==========================================
echo   INSTRUCTIONS:
echo   1. Wait for the browser to open.
echo   2. Right-click and PASTE (or press Ctrl+V) into the SQL Editor.
echo   3. Click the "RUN" button (bottom right).
echo ==========================================
echo.
pause
