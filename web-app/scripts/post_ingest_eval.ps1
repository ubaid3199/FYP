param(
  [string]$BenchModel = $(if ($env:BENCH_MODEL) { $env:BENCH_MODEL } else { "gemma4:e4b" })
)

$ErrorActionPreference = 'Stop'

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location ..

$benchDir = Join-Path (Get-Location) 'benchmarks'
New-Item -ItemType Directory -Force -Path $benchDir | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$smokeOut = Join-Path $benchDir ("post_ingest_smoke_{0}.txt" -f $timestamp)
$accOut = Join-Path $benchDir ("post_ingest_accuracy_{0}.txt" -f $timestamp)
$extOut = Join-Path $benchDir ("post_ingest_extensive_{0}.json" -f $timestamp)

Write-Host "[post_ingest_eval] Waiting for hybrid_store.json update..."
Write-Host "[post_ingest_eval] Bench model: $BenchModel"

$storeDir = Join-Path (Get-Location) '.vector_store'
$storeFile = Join-Path $storeDir 'hybrid_store.json'

$baselineLastWriteUtc = if (Test-Path $storeFile) {
  (Get-Item $storeFile).LastWriteTimeUtc
} else {
  [DateTime]::MinValue
}
Write-Host "[post_ingest_eval] Baseline LastWriteTimeUtc: $baselineLastWriteUtc"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $storeDir
$watcher.Filter = 'hybrid_store.json'
$watcher.NotifyFilter = [System.IO.NotifyFilters]'LastWrite,FileName,Size'
$watcher.EnableRaisingEvents = $true

$changedId = "hybrid_store_changed_$([Guid]::NewGuid().ToString('N'))"
$createdId = "hybrid_store_created_$([Guid]::NewGuid().ToString('N'))"
Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier $changedId | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName Created -SourceIdentifier $createdId | Out-Null

try {
  while ($true) {
    $evt = Wait-Event

    if ($evt.SourceIdentifier -ne $changedId -and $evt.SourceIdentifier -ne $createdId) {
      Remove-Event -EventIdentifier $evt.EventIdentifier -ErrorAction SilentlyContinue
      continue
    }

    Remove-Event -EventIdentifier $evt.EventIdentifier -ErrorAction SilentlyContinue

    if (Test-Path $storeFile) {
      $currentLastWriteUtc = (Get-Item $storeFile).LastWriteTimeUtc
      if ($currentLastWriteUtc -gt $baselineLastWriteUtc) {
        break
      }
    }
  }

  Write-Host "[post_ingest_eval] Detected update: $storeFile"

  # Quick connectivity check for the API server
  try {
    $status = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 3).StatusCode
    Write-Host "[post_ingest_eval] Server status: $status"
  }
  catch {
    Write-Host "[post_ingest_eval] WARN: localhost:3000 unreachable; benchmarks may fail."
  }

  Write-Host "[post_ingest_eval] Running smoke test -> $smokeOut"
  npx tsx smoke_test.ts 2>&1 | Tee-Object -FilePath $smokeOut
  if ($LASTEXITCODE -ne 0) { throw "Smoke test failed (exit $LASTEXITCODE)" }

  Write-Host "[post_ingest_eval] Running accuracy benchmark -> $accOut"
  $env:BENCH_MODEL = $BenchModel
  node test_accuracy_benchmark.js 2>&1 | Tee-Object -FilePath $accOut
  if ($LASTEXITCODE -ne 0) { throw "Accuracy benchmark failed (exit $LASTEXITCODE)" }

  Write-Host "[post_ingest_eval] Running extensive benchmark -> $extOut"
  node benchmark_extensive.js --label ("post_ingest_{0}" -f $timestamp) --out $extOut --model $BenchModel
  if ($LASTEXITCODE -ne 0) { throw "Extensive benchmark failed (exit $LASTEXITCODE)" }

  Write-Host "[post_ingest_eval] Done."
}
finally {
  Unregister-Event -SourceIdentifier $changedId -ErrorAction SilentlyContinue
  Unregister-Event -SourceIdentifier $createdId -ErrorAction SilentlyContinue
  $watcher.EnableRaisingEvents = $false
  $watcher.Dispose()
}
