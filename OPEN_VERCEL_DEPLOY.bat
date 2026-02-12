@echo off
echo ==========================================
echo   DEPLOY TO VERCEL (WEB SETUP)
echo ==========================================
echo.
echo [INFO] This script will open Vercel in your browser.
echo [INFO] You need to 'Import' the project you just pushed to GitHub.
echo.

:: Open Vercel Import Page
start https://vercel.com/new/import?s=https://github.com/tejas6tpf-debug/counting-app

echo --------------------------------------------------------------------------------
echo   IMPORTANT: YOU NEED THESE VARIABLES FOR VERCEL
echo   (Copy and paste them when Vercel asks for "Environment Variables")
echo --------------------------------------------------------------------------------
echo.
echo   Name:  VITE_SUPABASE_URL
echo   Value: https://jkahwsflhgsfotgvkckw.supabase.co
echo.
echo   Name:  VITE_SUPABASE_ANON_KEY
echo   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYWh3c2ZsaGdzZm90Z3ZrY2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODE2NDMsImV4cCI6MjA4NjI1NzY0M30.DuwKU8NVY5yCXKVqJuKcJewi0k74h5hMe8i-Ih_jcSM
echo.
echo --------------------------------------------------------------------------------
echo.
echo [INSTRUCTIONS]
echo 1. In the browser, click "Import" next to 'counting-app'.
echo 2. In "Configure Project", click "Environment Variables".
echo 3. Add the two variables shown above.
echo 4. Click "Deploy".
echo.
pause
