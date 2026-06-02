$ErrorActionPreference = "Stop"
$clientRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path

Push-Location $clientRoot
try {
  & (Join-Path $PSScriptRoot "ensure-toolchain.ps1")

  $viteJs = Join-Path $clientRoot "node_modules\vite\bin\vite.js"
  if (-not (Test-Path $viteJs)) {
    throw "vite.js is missing after toolchain preparation"
  }

  & node $viteJs build
  if ($LASTEXITCODE -ne 0) {
    throw "vite build failed with code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}
