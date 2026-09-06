# Build folder for Netlify Drop
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "deploy\netlify-drop"
$files = @(
    "index.html",
    "car-detail.html",
    "confirm.html",
    "complete.html",
    "admin.html",
    "admin-documents.html",
    "styles.css",
    "shared.js",
    "site-ui.js",
    "app.js",
    "car-detail.js",
    "confirm.js",
    "complete.js",
    "admin.js",
    "admin-documents.js",
    "mail-api.js",
    "site-config.js",
    "supabase-config.js",
    "supabase-data.js"
)

if (Test-Path $out) {
    Remove-Item $out -Recurse -Force
}
New-Item -ItemType Directory -Path $out -Force | Out-Null

foreach ($name in $files) {
    $src = Join-Path $root $name
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $out $name)
    } else {
        Write-Warning "Missing: $name"
    }
}

$readmeSrc = Join-Path $root "deploy\netlify-drop-README.txt"
if (Test-Path $readmeSrc) {
    Copy-Item $readmeSrc (Join-Path $out "README.txt")
}
Write-Host "Done: $out"
