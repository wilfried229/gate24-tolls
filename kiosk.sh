#!/bin/bash

@echo off

:loop
taskkill /F /IM chrome.exe >nul 2>&1

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --autoplay-policy=no-user-gesture-required --start-fullscreen http://localhost:3000

timeout /t 2 >nul
goto loop