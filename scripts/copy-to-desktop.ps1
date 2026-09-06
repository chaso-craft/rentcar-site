$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "deploy\netlify-drop"
$desktop = Join-Path $env:USERPROFILE "OneDrive"
$desktop = Join-Path $desktop "Desktop"
if (-not (Test-Path $desktop)) {
  $items = Get-ChildItem (Join-Path $env:USERPROFILE "OneDrive") -Directory
  $desktop = ($items | Where-Object { $_.Name -match "Desk" -or $_.Name -match "desk" } | Select-Object -First 1).FullName
}

$folder = Join-Path $desktop "rentcar-netlify-drop"
$zip = Join-Path $desktop "rentcar-netlify-drop.zip"

& (Join-Path $root "scripts\prepare-netlify-drop.ps1")

if (Test-Path $folder) { Remove-Item $folder -Recurse -Force }
Copy-Item $src $folder -Recurse -Force
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $folder "*") -DestinationPath $zip -Force

$bat = Join-Path $desktop "open-rentcar-site.bat"
Set-Content -Path $bat -Value "@echo off" -Encoding ASCII
Add-Content -Path $bat -Value "start `"`" `"$folder\index.html`"" -Encoding ASCII

Write-Output $folder
Write-Output $zip
Write-Output $bat
