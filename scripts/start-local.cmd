@echo off
chcp 65001 >nul
title Radio Learning System - One-Click Start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 pause
