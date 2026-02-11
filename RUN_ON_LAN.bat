@echo off
title Pegasus Spare - LAN Server
cls

echo ==========================================
echo    Pegasus Spare - Running on Network
echo ==========================================
echo.
echo [STEP 1] Checking requirements...
if not exist node_modules (
    echo [!] node_modules not found. Installing dependencies...
    call npm install
)

echo.
echo [STEP 2] Starting Network-Ready Server...
echo.
echo ------------------------------------------
echo IMPORTANT:
echo 1. Ensure your computer and your phone/tablet are on the SAME Wi-Fi.
echo 2. Look for the "Network" URL below once the server starts.
echo 3. Type that URL into your phone's browser to start scanning.
echo ------------------------------------------
echo.

:: Run vite with host flag to expose to LAN
call npm run dev -- --host

pause
