$desktopPath = [Environment]::GetFolderPath('Desktop')
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut("$desktopPath\Karma Print Manager.lnk")
$shortcut.TargetPath = "D:\karma-prient313\release\win-unpacked\Karma Print Manager.exe"
$shortcut.WorkingDirectory = "D:\karma-prient313\release\win-unpacked"
$shortcut.IconLocation = "D:\karma-prient313\release\win-unpacked\Karma Print Manager.exe"
$shortcut.Save()
