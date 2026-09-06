# Same Wi-Fi phone test server
param(
  [int]$Port = 8765
)

$root = Split-Path -Parent $PSScriptRoot
$site = Join-Path $root "deploy\netlify-drop"
$desktopDrop = Join-Path $env:USERPROFILE "OneDrive\デスクトップ\rentcar-netlify-drop"
if (Test-Path $desktopDrop) {
  $site = $desktopDrop
}

if (-not (Test-Path $site)) {
  & (Join-Path $root "scripts\prepare-netlify-drop.ps1")
  $site = Join-Path $root "deploy\netlify-drop"
}

function Get-LanIPv4 {
  $wifi = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch "^127\." -and
      $_.IPAddress -notmatch "^169\.254\."
    } |
    Sort-Object {
      if ($_.InterfaceAlias -match "Wi-?Fi|Wireless|WLAN") { 0 } else { 1 }
    }, InterfaceIndex
  if ($wifi) { return $wifi[0].IPAddress }

  foreach ($line in (ipconfig)) {
    if ($line -match "IPv4.*:\s*(\d+\.\d+\.\d+\.\d+)") {
      $candidate = $Matches[1]
      if ($candidate -notmatch "^127\." -and $candidate -notmatch "^169\.254\.") {
        return $candidate
      }
    }
  }
  return $null
}

function Resolve-NodeExe {
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$ip = Get-LanIPv4
if (-not $ip) {
  Write-Host "PC IP not found. Run ipconfig and check IPv4."
  exit 1
}

$ruleName = "RentcarLocalPhoneTest"
try {
  if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private -ErrorAction Stop | Out-Null
    Write-Host "Firewall: allowed port $Port"
  }
} catch {
  Write-Host "Firewall: run this bat as Administrator if phone cannot connect."
}

$url = "http://${ip}:${Port}/"
$urlFile = Join-Path $env:USERPROFILE "OneDrive\デスクトップ\レンタカー-スマホ用URL.txt"
Set-Content -Path $urlFile -Value $url -Encoding UTF8

Write-Host ""
Write-Host "========================================"
Write-Host " Open on iPhone Safari:"
Write-Host " $url"
Write-Host "========================================"
Write-Host ""
Write-Host "Do not close this window."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

$nodeExe = Resolve-NodeExe
if (-not $nodeExe) {
  Write-Host "Node.js not found. Install from https://nodejs.org/"
  exit 1
}

$serverJs = Join-Path $PSScriptRoot "serve-for-phone-server.js"
Set-Location $site
& $nodeExe $serverJs $Port $site
exit $LASTEXITCODE
