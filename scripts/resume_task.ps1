# PanHub 任务断点即时恢复脚本
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$ProgressFile = Join-Path $ProjectRoot ".task_progress.json"
if (!(Test-Path $ProgressFile)) {
    Write-Host "[ERROR] 未找到任务进度文件: $ProgressFile" -ForegroundColor Red
    exit 1
}

$Progress = Get-Content -Path $ProgressFile -Raw -Encoding UTF8 | ConvertFrom-Json
$Phase = $Progress.current_phase
$PhaseInfo = $Progress.phases.$Phase

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "      PanHub 任务断点恢复与进度看板               " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "当前阶段: Phase $Phase - $($PhaseInfo.name)" -ForegroundColor Yellow
Write-Host "最后心跳: $($Progress.last_heartbeat)" -ForegroundColor Gray
Write-Host ""
Write-Host "子步骤执行状态:" -ForegroundColor White
foreach ($step in $PhaseInfo.steps) {
    $color = if ($step.status -eq "completed") { "Green" } elseif ($step.status -eq "in_progress") { "Yellow" } else { "DarkGray" }
    $icon = if ($step.status -eq "completed") { "✓" } elseif ($step.status -eq "in_progress") { "▶" } else { "○" }
    Write-Host "  $icon [$($step.id)] $($step.name) - $($step.status)" -ForegroundColor $color
}
Write-Host "==================================================" -ForegroundColor Cyan
