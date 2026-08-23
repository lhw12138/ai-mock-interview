$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$version = "v20.20.2"
$archive = "$env:TEMP\node-$version-linux-x64.tar.xz"
$extractDir = "$env:TEMP\node-$version-linux-x64"

if (-not (Test-Path "$extractDir\bin\node")) {
  Write-Host "Downloading Node.js $version (linux-x64)..."
  curl.exe -s -L -o $archive --max-time 300 "https://nodejs.org/dist/$version/node-$version-linux-x64.tar.xz"
  if ($LASTEXITCODE -ne 0) { throw "Download failed" }
  tar -xf $archive -C "$env:TEMP"
}

New-Item -ItemType Directory -Force ".node-runtime" | Out-Null
Copy-Item "$extractDir\bin\node" ".node-runtime\node" -Force
Write-Host "Node runtime ready: .node-runtime\node"
