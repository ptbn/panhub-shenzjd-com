# scripts/start_watchdog.ps1
# 启动 10 分钟本地守护脚本 (纯 Node.js 进程，独立后台运行，零模型算力依赖)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

$PidFile = Join-Path $ProjectRoot "logs\watchdog.pid"
$LogFile = Join-Path $ProjectRoot "logs\watchdog.log"

if (Test-Path $PidFile) {
    $OldPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($OldPid) {
        $Proc = Get-Process -Id $OldPid -ErrorAction SilentlyContinue
        if ($Proc) {
            Write-Output "Watchdog is already running with PID: $OldPid"
            Write-Output "To view real-time logs, run: Get-Content logs/watchdog.log -Tail 20 -Wait"
            exit 0
        }
    }
}

$Process = Start-Process -FilePath "node" -ArgumentList "scripts/watchdog.mjs" -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
Set-Content -Path $PidFile -Value $Process.Id -Force
Write-Output "Watchdog started successfully. PID: $($Process.Id)"
Write-Output "Log file: $LogFile"
