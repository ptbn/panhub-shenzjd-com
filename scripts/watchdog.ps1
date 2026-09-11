# PanHub Auto-Healing & Task Progress Watchdog Daemon
# Runs independently every 10 minutes without model compute

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$LogsDir = Join-Path $ProjectRoot "logs"
if (!(Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$LogFile = Join-Path $LogsDir "watchdog.log"
$ProgressFile = Join-Path $ProjectRoot ".task_progress.json"

function Write-WatchdogLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $Line = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $Line -Encoding UTF8
    Write-Host $Line
}

Write-WatchdogLog ">>> PanHub Watchdog Daemon Started (Polling Interval: 10 mins) <<<"

while ($true) {
    try {
        Write-WatchdogLog "Starting 10-min heartbeat check..."

        if (Test-Path $ProgressFile) {
            $JsonContent = Get-Content -Path $ProgressFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $CurrentPhase = $JsonContent.current_phase
            $PhaseName = $JsonContent.phases.$CurrentPhase.name
            Write-WatchdogLog "Current Task Phase: Phase $CurrentPhase - $PhaseName"

            # Update heartbeat timestamp
            $JsonContent.last_heartbeat = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            $JsonContent | ConvertTo-Json -Depth 10 | Set-Content -Path $ProgressFile -Encoding UTF8
        }

        # Run quick regression test probe
        Write-WatchdogLog "Running quick regression test probe..."
        $TestOutput = & npx vitest run test/unit/canonicalUrl.test.ts test/unit/magnet-filter.test.ts --passWithNoTests 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-WatchdogLog "Health Check: PASS" "SUCCESS"
        } else {
            Write-WatchdogLog "Health Check Warning: Test failed" "WARN"
        }
    } catch {
        Write-WatchdogLog "Watchdog exception: $_" "ERROR"
    }

    Write-WatchdogLog "Check complete. Sleeping for 600 seconds (10 mins)..."
    Start-Sleep -Seconds 600
}
