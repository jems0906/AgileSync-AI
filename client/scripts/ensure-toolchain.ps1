param(
  [int]$MaxAttempts = 2
)

$ErrorActionPreference = "Stop"
$clientRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$viteCmd = Join-Path $clientRoot "node_modules\.bin\vite.cmd"
$viteJs = Join-Path $clientRoot "node_modules\vite\bin\vite.js"
$esbuildExe = Join-Path $clientRoot "node_modules\@esbuild\win32-x64\esbuild.exe"

function Write-Step {
  param(
    [string]$Message
  )

  Write-Output "[ensure-toolchain] $Message"
}

function Invoke-NpmInstall {
  param(
    [string]$WorkingDirectory
  )

  Write-Step "Running npm install in $WorkingDirectory"
  Push-Location $WorkingDirectory
  try {
    & npm.cmd install --include=dev --no-audit --no-fund --loglevel=notice
    if ($LASTEXITCODE -ne 0) {
      throw "npm install exited with code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

function Set-BinShims {
  param(
    [string]$WorkingDirectory
  )

  $binDir = Join-Path $WorkingDirectory "node_modules\.bin"
  if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
  }

  $viteJsPath = Join-Path $WorkingDirectory "node_modules\vite\bin\vite.js"
  if (Test-Path $viteJsPath) {
    $viteCmdPath = Join-Path $binDir "vite.cmd"
    $viteCmdContent = @(
      "@ECHO off",
      "node `"%~dp0..\vite\bin\vite.js`" %*"
    ) -join "`r`n"
    Set-Content -LiteralPath $viteCmdPath -Value $viteCmdContent -Encoding ASCII

    $vitePs1Path = Join-Path $binDir "vite.ps1"
    $vitePs1Content = @(
      "#!/usr/bin/env pwsh",
      'node "$PSScriptRoot\..\vite\bin\vite.js" $args'
    ) -join "`r`n"
    Set-Content -LiteralPath $vitePs1Path -Value $vitePs1Content -Encoding ASCII
  }

  $esbuildExePath = Join-Path $WorkingDirectory "node_modules\@esbuild\win32-x64\esbuild.exe"
  if (Test-Path $esbuildExePath) {
    $esbuildCmdPath = Join-Path $binDir "esbuild.cmd"
    $esbuildCmdContent = @(
      "@ECHO off",
      "`"%~dp0..\@esbuild\win32-x64\esbuild.exe`" %*"
    ) -join "`r`n"
    Set-Content -LiteralPath $esbuildCmdPath -Value $esbuildCmdContent -Encoding ASCII

    $esbuildPs1Path = Join-Path $binDir "esbuild.ps1"
    $esbuildPs1Content = @(
      "#!/usr/bin/env pwsh",
      '& "$PSScriptRoot\..\@esbuild\win32-x64\esbuild.exe" $args'
    ) -join "`r`n"
    Set-Content -LiteralPath $esbuildPs1Path -Value $esbuildPs1Content -Encoding ASCII
  }
}

function Repair-EsbuildArtifacts {
  param(
    [string]$WorkingDirectory
  )

  $targets = @(
    "node_modules\esbuild",
    "node_modules\@esbuild",
    "node_modules\.bin\vite.cmd",
    "node_modules\.bin\vite"
  )

  foreach ($target in $targets) {
    $fullPath = Join-Path $WorkingDirectory $target
    if (Test-Path $fullPath) {
      Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Repair-RollupNativeArtifacts {
  param(
    [string]$WorkingDirectory
  )

  $nativeDir = Join-Path $WorkingDirectory "node_modules\@rollup\rollup-win32-x64-msvc"
  if (Test-Path $nativeDir) {
    Get-ChildItem -LiteralPath $nativeDir -Filter "*.node" -File -ErrorAction SilentlyContinue | ForEach-Object {
      Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue
      & attrib -R $_.FullName 2>$null
    }
  }
}

function Set-NativeToolEnvironment {
  param(
    [string]$WorkingDirectory
  )

  $stageDir = Join-Path $env:LOCALAPPDATA "AgileSyncNativeTools"
  New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

  $sourceEsbuildExe = Join-Path $WorkingDirectory "node_modules\@esbuild\win32-x64\esbuild.exe"
  $sourceRollupNode = Join-Path $WorkingDirectory "node_modules\@rollup\rollup-win32-x64-msvc\rollup.win32-x64-msvc.node"
  if (-not (Test-Path $sourceEsbuildExe) -or -not (Test-Path $sourceRollupNode)) {
    throw "Native tool binaries are missing from node_modules"
  }

  $stagedEsbuildExe = Join-Path $stageDir "esbuild.exe"
  $stagedRollupNode = Join-Path $stageDir "rollup.win32-x64-msvc.node"

  Copy-Item -LiteralPath $sourceEsbuildExe -Destination $stagedEsbuildExe -Force
  Copy-Item -LiteralPath $sourceRollupNode -Destination $stagedRollupNode -Force
  Unblock-File -LiteralPath $stagedEsbuildExe -ErrorAction SilentlyContinue
  Unblock-File -LiteralPath $stagedRollupNode -ErrorAction SilentlyContinue

  $rollupPackageDir = Join-Path $WorkingDirectory "node_modules\@rollup\rollup-win32-x64-msvc"
  $rollupLoaderPath = Join-Path $rollupPackageDir "rollup-loader.cjs"
  $rollupPackageJsonPath = Join-Path $rollupPackageDir "package.json"

  $escapedRollupNode = $stagedRollupNode.Replace('\', '\\')
  $rollupLoaderContent = @"
module.exports = require("$escapedRollupNode");
"@
  Set-Content -LiteralPath $rollupLoaderPath -Value $rollupLoaderContent -Encoding ASCII

  $rollupPackageJson = Get-Content -LiteralPath $rollupPackageJsonPath -Raw | ConvertFrom-Json
  $rollupPackageJson.main = "./rollup-loader.cjs"
  $rollupPackageJson | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $rollupPackageJsonPath -Encoding ASCII

  $env:ESBUILD_BINARY_PATH = $stagedEsbuildExe
  Write-Step "native-tools:staged"
}

function Test-RollupNativeLoad {
  param(
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & node -e "require('@rollup/rollup-win32-x64-msvc')"
    return ($LASTEXITCODE -eq 0)
  }
  catch {
    return $false
  }
  finally {
    Pop-Location
  }
}

function Initialize-RollupNative {
  param(
    [string]$WorkingDirectory
  )

  Repair-RollupNativeArtifacts -WorkingDirectory $WorkingDirectory
  Set-NativeToolEnvironment -WorkingDirectory $WorkingDirectory
  if (Test-RollupNativeLoad -WorkingDirectory $WorkingDirectory) {
    Write-Step "rollup-native:ready"
    return
  }

  throw "rollup-native still failing load check after staging native binaries"
}

if (Test-Path $viteCmd) {
  Initialize-RollupNative -WorkingDirectory $clientRoot
  Write-Step "toolchain:ready"
  exit 0
}

if ((Test-Path $viteJs) -and (Test-Path $esbuildExe)) {
  Write-Step "Detected installed Vite/esbuild packages; repairing .bin shims"
  Set-BinShims -WorkingDirectory $clientRoot
  if (Test-Path $viteCmd) {
    Initialize-RollupNative -WorkingDirectory $clientRoot
    Write-Step "toolchain:ready"
    exit 0
  }
}

$lastError = $null
for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
  try {
    Write-Step "Attempt $attempt of $MaxAttempts"
    Invoke-NpmInstall -WorkingDirectory $clientRoot

    $esbuildExePath = Join-Path $clientRoot "node_modules\@esbuild\win32-x64\esbuild.exe"
    if (Test-Path $esbuildExePath) {
      Unblock-File -LiteralPath $esbuildExePath -ErrorAction SilentlyContinue
    }

    Set-BinShims -WorkingDirectory $clientRoot

    if (Test-Path $viteCmd) {
      Initialize-RollupNative -WorkingDirectory $clientRoot
      Write-Step "toolchain:ready"
      exit 0
    }

    throw "vite command is still missing after install"
  }
  catch {
    $lastError = $_
    Write-Step "Attempt $attempt failed: $($lastError.Exception.Message)"
    Write-Step "Repairing esbuild and vite artifacts"
    Repair-EsbuildArtifacts -WorkingDirectory $clientRoot
  }
}

throw "Failed to prepare client toolchain after $MaxAttempts attempts. Last error: $($lastError.Exception.Message)"
