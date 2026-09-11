# scripts/stop_watchdog.ps1
# 停止 10 分钟本地守护进程

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$PidFile = Join-Path $ProjectRoot "logs\watchdog.pid"

if (Test-Path $PidFile) {
    $TargetPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($TargetPid) {
        $Proc = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
        if ($Proc) {
            Stop-Process -Id $TargetPid -Force
            Write-Output "Watchdog process (PID: $TargetPid) has been stopped."
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Output "No watchdog PID file found."
}
