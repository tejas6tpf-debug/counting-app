@echo off
echo ==========================================
echo   FIX LOGIN AND PUSH TO GITHUB
echo ==========================================
echo.
echo [PROBLEM] You are logged in as 'TEJAS4227' but the repo belongs to 'tejas6tpf-debug'.
echo [SOLUTION] We need to clear your saved login and sign in again as 'tejas6tpf-debug'.
echo.

:: 1. Clear Credentials
echo [1/5] Clearing old GitHub credentials...
cmdkey /delete:git:https://github.com >nul 2>&1
echo Credentials cleared.

:: 2. Reset Git
if exist .git (
    echo [2/5] Resetting repository...
    rmdir /s /q .git
)
git init
git branch -M main

:: 3. Add Files
echo [3/5] Adding files...
git add .
git commit -m "Fresh push" >nul 2>&1

:: 4. Get URL
echo.
echo [INPUT REQUIRED] Paste your GitHub Repository URL below:
echo (e.g. https://github.com/tejas6tpf-debug/counting-app.git)
set /p REPO_URL="Repository URL: "

:: 5. Push with forced authentication
echo.
echo [4/5] Setting remote...
git remote add origin %REPO_URL%

echo [5/5] Pushing to GitHub...
echo.
echo -------------------------------------------------------------
echo  [IMPORTANT] A login window will open.
echo  You MUST login as 'tejas6tpf-debug' (The Repo Owner)
echo  Do NOT login as 'TEJAS4227'
echo -------------------------------------------------------------
echo.

git push -u origin main --force

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed again.
    echo.
    echo Solution if this fails:
    echo 1. Go to GitHub.com and log out.
    echo 2. Log in as 'tejas6tpf-debug'.
    echo 3. Run this script again.
) else (
    echo.
    echo [SUCCESS] Code pushed successfully!
)

echo.
pause
