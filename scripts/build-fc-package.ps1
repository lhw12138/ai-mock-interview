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
if (Test-Path fc-package.zip) { Remove-Item -Force fc-package.zip }
Compress-Archive -Path "fc-package\*" -DestinationPath "fc-package.zip" -Force
Write-Host "部署包已生成: fc-package.zip"
