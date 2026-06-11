$appName = "Digital Clock"
$appExe = "app.exe"
$installDir = "$env:LOCALAPPDATA\DigitalClock"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\$appName.lnk"

# Check if app.exe exists in the current directory
if (-Not (Test-Path ".\dist\$appExe")) {
    Write-Host "Error: Could not find .\dist\$appExe. Please ensure you run this from the project folder." -ForegroundColor Red
    Pause
    exit
}

Write-Host "Installing $appName..."

# Create installation directory if it doesn't exist
if (-Not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
}

# Copy the executable
Copy-Item -Path ".\dist\$appExe" -Destination "$installDir\$appExe" -Force
Write-Host "Copied $appExe to $installDir"

# Create a Desktop Shortcut
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$installDir\$appExe"
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "Launch $appName"
$shortcut.Save()

Write-Host "Created desktop shortcut at $shortcutPath"

Write-Host "Installation completed successfully!" -ForegroundColor Green

# Optional: Launch the app
$response = Read-Host "Do you want to launch $appName now? (Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    Start-Process "$installDir\$appExe"
}
