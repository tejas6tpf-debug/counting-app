@echo off
echo Updating git repository...
git add .
git commit -m "Live Reports Update: Tab-specific export, Category column, and NN Carton fix"
git push origin main
echo.
echo Updates pushed successfully to GitHub!
pause
