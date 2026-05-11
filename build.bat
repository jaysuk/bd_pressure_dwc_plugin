@echo off
setlocal

set DWC_DIR=c:\Users\live\Documents\Input Shaping\DuetWebControl-3.6-dev
set PLUGIN_REPO=%~dp0
set PLUGIN_ID=BdPressurePA

echo Building plugin...
cd /d "%DWC_DIR%"
call npm run build-plugin -- %PLUGIN_ID%
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

for /f "delims=" %%f in ('dir /b /o-d "%DWC_DIR%\dist\%PLUGIN_ID%-*.zip" 2^>nul') do (
    set ZIP=%%f
    goto :found
)
echo No ZIP found in dist\
exit /b 1

:found
echo Copying %ZIP% to plugin repo...
copy /y "%DWC_DIR%\dist\%ZIP%" "%PLUGIN_REPO%%ZIP%" >nul
echo Done: %PLUGIN_REPO%%ZIP%
