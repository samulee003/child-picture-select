$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -eq 0) {
    npm exec electron-builder
}

