param(
  [string]$ApiBase = "http://localhost:4000/api",
  [int]$Port = 5173,
  [int]$StartupTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"
$clientRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$clientBase = "http://127.0.0.1:$Port"
$headers = @{ "x-role" = "PM" }
$devProcess = $null
$devStdOutLog = $null
$devStdErrLog = $null

function Write-Step {
  param(
    [string]$Message
  )

  Write-Output "[smoke-client] $Message"
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

try {
  Write-Step "Preparing client toolchain"
  & (Join-Path $PSScriptRoot "ensure-toolchain.ps1")

  Write-Step "Checking API health at $ApiBase/health"
  $health = Invoke-RestMethod -Method Get -Uri "$ApiBase/health" -Headers $headers
  Assert-True ($health.ok -eq $true) "API health check failed"

  Push-Location $clientRoot
  try {
    Write-Step "Running reliable client build"
    & npm.cmd run build:reliable
    if ($LASTEXITCODE -ne 0) {
      throw "Client build failed with code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }

  Write-Step "Starting Vite dev server on $clientBase"
  $viteJs = Join-Path $clientRoot "node_modules\vite\bin\vite.js"
  Assert-True (Test-Path $viteJs) "Vite binary not found after reliable build"
  $devArgs = @("`"$viteJs`"", "--host", "127.0.0.1", "--port", "$Port", "--strictPort")
  $devStdOutLog = Join-Path $env:TEMP "agilesync-vite-dev.out.log"
  $devStdErrLog = Join-Path $env:TEMP "agilesync-vite-dev.err.log"
  Remove-Item -LiteralPath $devStdOutLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $devStdErrLog -Force -ErrorAction SilentlyContinue
  $devProcess = Start-Process -FilePath "node.exe" -ArgumentList $devArgs -WorkingDirectory $clientRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $devStdOutLog -RedirectStandardError $devStdErrLog

  $ready = $false
  $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri "$clientBase/" -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        $ready = $true
        break
      }
    }
    catch {
      # Waiting for Vite dev server to become available.
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $ready) {
    $stderrTail = ""
    if ($devStdErrLog -and (Test-Path $devStdErrLog)) {
      $stderrTail = (Get-Content -LiteralPath $devStdErrLog -Tail 40 -ErrorAction SilentlyContinue) -join "`n"
    }

    $stdoutTail = ""
    if ($devStdOutLog -and (Test-Path $devStdOutLog)) {
      $stdoutTail = (Get-Content -LiteralPath $devStdOutLog -Tail 40 -ErrorAction SilentlyContinue) -join "`n"
    }

    throw "Client dev server did not become ready in time. stdout: $stdoutTail stderr: $stderrTail"
  }

  Write-Step "Validating client root page content"
  $page = Invoke-WebRequest -Uri "$clientBase/" -UseBasicParsing -TimeoutSec 5
  $content = [string]$page.Content
  Assert-True ($content -match "AgileSync AI") "Client page does not contain expected app title"

  Write-Step "Smoke test passed"
  [pscustomobject]@{
    status = "passed"
    apiHealthOk = $health.ok
    build = "passed"
    devServer = "passed"
    clientBase = $clientBase
    apiBase = $ApiBase
  } | ConvertTo-Json -Depth 6
}
catch {
  Write-Error "Client smoke failed: $($_.Exception.Message)"
  exit 1
}
finally {
  Write-Step "Stopping Vite dev server"
  if ($devProcess -and -not $devProcess.HasExited) {
    Stop-Process -Id $devProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
