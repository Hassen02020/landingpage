@echo off
echo === DEPLOY TO GITHUB ===
cd /d "C:\Users\user\CascadeProjects\landingpage"
echo.
echo Adding files...
git add .
echo.
echo Committing...
git commit -m "feat: ajouter Foj 3 Mawlid + corriger dates + poster video"
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo === DEPLOYMENT COMPLETE ===
pause
