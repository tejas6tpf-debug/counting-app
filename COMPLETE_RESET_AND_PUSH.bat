@echo off
echo ==========================================
echo   COMPLETE RESET & PUSH TO GITHUB
echo ==========================================
echo.
echo [WARNING] This will reset your local Git configuration for this project.
echo This is safe for a new project upload. It fixes most errors.
echo.

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed.
    pause
    exit /b
)

:: 1. Clear old git folder
if exist .git (
    echo [1/5] Removing old Git configuration...
    rmdir /s /q .git
)

:: 2. Initialize fresh
echo [2/5] Initializing new repository...
git init
git branch -M main

:: 3. Add files
echo [3/5] Adding project files...
git add .
git commit -m "Fresh upload for Vercel" >nul 2>&1

:: 4. Get URL
echo.
echo [INPUT REQUIRED] Paste your GitHub Repository URL below:
set /p REPO_URL="Repository URL: "
echo.

:: 5. Add remote and push
echo [4/5] Setting remote origin...
git remote add origin %REPO_URL%

echo [5/5] FORCE PUSHING to GitHub...
echo.
echo -------------------------------------------------------------
echo  If a login window appears, please sign in!
echo -------------------------------------------------------------
echo.

git push -u origin main --force

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed.
    echo.
    echo POSSIBLE CAUSES:
    echo 1. Wrong URL (Check if you copied it correctly)
    echo 2. Internet issue
    echo 3. Permission denied (Login failed)
    echo.
) else (
    echo.
    echo [SUCCESS] Code uploaded successfully!
    echo Now go to Vercel and import the project.
)

echo.
pause
