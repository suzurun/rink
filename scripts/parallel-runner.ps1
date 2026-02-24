# Parallel Task Runner for Claude Code Development
# AIT42エージェントを並列実行するためのPowerShellスクリプト

param(
    [Parameter(Mandatory=$false)]
    [string[]]$Tasks,

    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = ".claude/parallel-tasks.json",

    [Parameter(Mandatory=$false)]
    [int]$MaxParallel = 4,

    [Parameter(Mandatory=$false)]
    [switch]$ShowLogs,

    [Parameter(Mandatory=$false)]
    [ValidateSet('start', 'status', 'stop', 'logs')]
    [string]$Action = 'start'
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$LogsDir = Join-Path $ProjectRoot "logs\parallel-tasks"
$JobsFile = Join-Path $LogsDir "active-jobs.json"

# ログディレクトリの作成
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

function Show-Header {
    Write-Host ""
    Write-Host "=== Parallel Task Runner for Claude Code ===" -ForegroundColor Cyan
    Write-Host ""
}

function Start-ParallelTasks {
    param(
        [string[]]$TaskList,
        [int]$MaxJobs
    )

    if (-not $TaskList -or $TaskList.Count -eq 0) {
        # 設定ファイルから読み込み
        $configPath = Join-Path $ProjectRoot $ConfigFile
        if (Test-Path $configPath) {
            $config = Get-Content $configPath | ConvertFrom-Json
            $TaskList = $config.tasks
            Write-Host "📄 Loaded tasks from config: $ConfigFile" -ForegroundColor Green
        } else {
            Write-Host "❌ No tasks specified and config file not found: $ConfigFile" -ForegroundColor Red
            Write-Host ""
            Write-Host "Usage:" -ForegroundColor Yellow
            Write-Host "  .\parallel-runner.ps1 -Tasks 'npm test','npm run build'" -ForegroundColor Cyan
            Write-Host "  Or create $ConfigFile with task definitions" -ForegroundColor Cyan
            Write-Host ""
            return
        }
    }

    Write-Host "🚀 Starting parallel tasks..." -ForegroundColor Green
    Write-Host "   Max parallel: $MaxJobs" -ForegroundColor Cyan
    Write-Host "   Total tasks: $($TaskList.Count)" -ForegroundColor Cyan
    Write-Host ""

    $jobs = @()
    $jobInfo = @()
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

    foreach ($task in $TaskList) {
        $taskName = $task -replace '[^a-zA-Z0-9-]', '-'
        $logFile = Join-Path $LogsDir "$timestamp-$taskName.log"

        Write-Host "▶️  Starting: $task" -ForegroundColor Yellow

        $scriptBlock = {
            param($cmd, $log)
            $output = Invoke-Expression $cmd 2>&1
            $output | Out-File -FilePath $log -Encoding UTF8
            return @{
                Command = $cmd
                ExitCode = $LASTEXITCODE
                Output = $output
            }
        }

        $job = Start-Job -ScriptBlock $scriptBlock -ArgumentList $task, $logFile
        $jobs += $job
        $jobInfo += @{
            Id = $job.Id
            Name = $job.Name
            Task = $task
            LogFile = $logFile
            StartTime = Get-Date
        }

        # 並列数制御
        while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $MaxJobs) {
            Start-Sleep -Milliseconds 500
        }
    }

    Write-Host ""
    Write-Host "⏳ Waiting for all tasks to complete..." -ForegroundColor Yellow
    Write-Host ""

    # ジョブ情報を保存
    $jobInfo | ConvertTo-Json | Out-File $JobsFile -Encoding UTF8

    # 全ジョブの完了を待つ
    $jobs | Wait-Job | Out-Null

    # 結果表示
    Write-Host "📊 Task Results:" -ForegroundColor Green
    Write-Host ""

    $successCount = 0
    $failCount = 0

    foreach ($job in $jobs) {
        $result = Receive-Job -Job $job
        $info = $jobInfo | Where-Object { $_.Id -eq $job.Id } | Select-Object -First 1

        $duration = (Get-Date) - $info.StartTime
        $status = if ($job.State -eq 'Completed' -and $result.ExitCode -eq 0) {
            $successCount++
            "✅ SUCCESS"
        } else {
            $failCount++
            "❌ FAILED"
        }

        Write-Host "  $status | $($info.Task)" -ForegroundColor $(if ($status -match 'SUCCESS') { 'Green' } else { 'Red' })
        Write-Host "    Duration: $($duration.TotalSeconds.ToString('F2'))s" -ForegroundColor Gray
        Write-Host "    Log: $($info.LogFile)" -ForegroundColor Gray
        Write-Host ""
    }

    # サマリー
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "Summary: $successCount succeeded, $failCount failed" -ForegroundColor $(if ($failCount -eq 0) { 'Green' } else { 'Yellow' })
    Write-Host ""

    # クリーンアップ
    $jobs | Remove-Job
}

function Show-TaskStatus {
    if (-not (Test-Path $JobsFile)) {
        Write-Host "📭 No active tasks found" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    $jobs = Get-Content $JobsFile | ConvertFrom-Json

    Write-Host "📊 Task Status:" -ForegroundColor Green
    Write-Host ""

    foreach ($job in $jobs) {
        Write-Host "  Task: $($job.Task)" -ForegroundColor Cyan
        Write-Host "    Started: $($job.StartTime)" -ForegroundColor Gray
        Write-Host "    Log: $($job.LogFile)" -ForegroundColor Gray
        Write-Host ""
    }
}

function Show-TaskLogs {
    if (-not (Test-Path $LogsDir)) {
        Write-Host "📭 No logs found" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    $logs = Get-ChildItem $LogsDir -Filter "*.log" | Sort-Object LastWriteTime -Descending

    if ($logs.Count -eq 0) {
        Write-Host "📭 No log files found" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    Write-Host "📄 Recent Logs:" -ForegroundColor Green
    Write-Host ""

    foreach ($log in $logs | Select-Object -First 10) {
        Write-Host "  $($log.Name)" -ForegroundColor Cyan
        Write-Host "    Modified: $($log.LastWriteTime)" -ForegroundColor Gray
        Write-Host "    Size: $([math]::Round($log.Length / 1KB, 2)) KB" -ForegroundColor Gray
        Write-Host ""
    }

    if ($ShowLogs) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "Latest Log Content:" -ForegroundColor Green
        Write-Host ""
        Get-Content $logs[0].FullName | Select-Object -Last 50
        Write-Host ""
    }
}

function Stop-AllTasks {
    Write-Host "🛑 Stopping all background jobs..." -ForegroundColor Yellow
    Write-Host ""

    $jobs = Get-Job
    if ($jobs) {
        $jobs | Stop-Job
        $jobs | Remove-Job
        Write-Host "✅ All jobs stopped" -ForegroundColor Green
    } else {
        Write-Host "📭 No active jobs found" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Main execution
Show-Header

switch ($Action) {
    'start' {
        Start-ParallelTasks -TaskList $Tasks -MaxJobs $MaxParallel
    }
    'status' {
        Show-TaskStatus
    }
    'logs' {
        Show-TaskLogs
    }
    'stop' {
        Stop-AllTasks
    }
}
