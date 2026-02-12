@echo off
echo ==========================================
echo   LOGIN TO GITHUB & PUSH (FORCE MODE)
echo ==========================================
echo.
echo [INFO] This script will check your git status and force push if needed.

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed.
    pause
    exit /b
)

if not exist .git (
    echo [1/4] Initializing Git...
    git init
)

echo [2/4] Saving changes locally...
git add .
git commit -m "Force push update" >nul 2>&1

echo [3/4] Setup Remote Repository...
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [INPUT NEEDED] Paste your GitHub Repository URL below:
    set /p REPO_URL="Repository URL: "
    git remote add origin %REPO_URL%
) else (
    echo Remote already set.
)

echo.
echo [4/4] Attempting to Push...
echo.
echo -------------------------------------------------------------
echo  Trying standard push first...
echo -------------------------------------------------------------
git branch -M main
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Standard push failed. This often happens if the repo is not empty.
    echo.
    echo -------------------------------------------------------------
    echo  Attempting FORCE PUSH (Overwriting remote with local code)...
    echo -------------------------------------------------------------
    git push -u origin main --force
    
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Force push also failed.
        echo Pleaee check your internet connection or permissions.
        echo You might need to re-login:
        echo Run: git credential-manager uninstall
    ) else (
        echo.
        echo [SUCCESS] Code FORCE PUSHED successfully!
    )
) else (
    echo.
    echo [SUCCESS] Code pushed successfully!
)

echo.
pause
