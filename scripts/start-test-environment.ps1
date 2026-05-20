$ErrorActionPreference = "Stop"

$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$Port = 5173

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
  $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $pids) {
    Stop-Process -Id $processId -Force
  }
}

Set-Location $ProjectDir
$setupOutput = & node .\scripts\create-test-environment.js
$config = @{}
foreach ($line in $setupOutput) {
  if ($line -match "^(?<key>[^=]+)=(?<value>.+)$") {
    $config[$Matches.key] = $Matches.value
  }
}

$env:SIMPLE_WORKFLOW_REPOSITORY_DIR = $config["SIMPLE_WORKFLOW_REPOSITORY_DIR"]
$env:SIMPLE_WORKFLOW_TASKS_DIR = $config["SIMPLE_WORKFLOW_TASKS_DIR"]
$env:SIMPLE_WORKFLOW_CONTEXT_STORE_DIR = $config["SIMPLE_WORKFLOW_CONTEXT_STORE_DIR"]
$env:PORT = "$Port"

Write-Host "simple-workflow test environment"
Write-Host "repository: $env:SIMPLE_WORKFLOW_REPOSITORY_DIR"
Write-Host "tasks:      $env:SIMPLE_WORKFLOW_TASKS_DIR"
Write-Host "url:        http://localhost:$Port"

& npm.cmd start
