#!/bin/bash

@echo off

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --autoplay-policy=no-user-gesture-required --start-fullscreen http://localhost:3000

exit