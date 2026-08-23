$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# 停掉占用 3000 端口的本地开发服务（如有），避免构建产物互相覆盖
$listener = netstat -ano | Select-String ":3000" | Select-String "LISTENING"
if ($listener) {
  $parts = ($listener.Line -split "\s+") | Where-Object { $_ }
  Stop-Process -Id ([int]$parts[$parts.Count - 1]) -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

$env:NEXT_OUTPUT_STANDALONE = "1"
$env:NEXT_TELEMETRY_DISABLED = "1"
npm run build
if ($LASTEXITCODE -ne 0) { throw "构建失败" }

if (Test-Path fc-package) { Remove-Item -Recurse -Force fc-package }
New-Item -ItemType Directory -Force fc-package | Out-Null
Copy-Item -Recurse ".next\standalone\*" "fc-package\"
Copy-Item -Recurse ".next\static" "fc-package\.next\static"
if (Test-Path public) { Copy-Item -Recurse public "fc-package\public" }
if (Test-Path ".node-runtime\node") {
  Copy-Item ".node-runtime\node" "fc-package\node" -Force
} else {
  throw "Missing .node-runtime\node. Run scripts\prepare-node-runtime.ps1 first."
}
if (Test-Path fc-package.zip) { Remove-Item -Force fc-package.zip }
# 使用 tar（libarchive）生成标准 zip，避免 Compress-Archive 与阿里云解压器的兼容问题
tar -a -c -f fc-package.zip -C fc-package server.js package.json node_modules .next public node
if ($LASTEXITCODE -ne 0) { throw "zip create failed" }
Write-Host "Package ready: fc-package.zip"
