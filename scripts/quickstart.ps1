# Quick Start Script for Claude Code Development Environment
# Simplified version for immediate use

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('status', 'feature', 'test')]
    [string]$Command = 'status',

    [Parameter(Mandatory=$false)]
    [string]$Name
)

function Show-Status {
    Write-Host ""
    Write-Host "=== Claude Code Development Environment ===" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Git Status:" -ForegroundColor Green
    git status --short
    Write-Host ""

    Write-Host "Worktrees:" -ForegroundColor Green
    git worktree list
    Write-Host ""

    Write-Host "AIT42 Agents:" -ForegroundColor Green
    $agentCount = (Get-ChildItem .claude/agents -Filter *.md).Count
    Write-Host "  Total: $agentCount agents available" -ForegroundColor Cyan
    Write-Host "  Coordinator: 00-ait42-coordinator.md" -ForegroundColor Yellow
    Write-Host ""
}

function New-Feature {
    param([string]$FeatureName)

    if (-not $FeatureName) {
        Write-Host "Error: Feature name required" -ForegroundColor Red
        Write-Host "Usage: .\quickstart.ps1 -Command feature -Name 'my-feature'" -ForegroundColor Yellow
        return
    }

    Write-Host ""
    Write-Host "Creating new feature: $FeatureName" -ForegroundColor Green
    Write-Host ""

    $branchName = "feature/$FeatureName"
    $worktreePath = "worktrees/$FeatureName"

    if (-not (Test-Path "worktrees")) {
        New-Item -ItemType Directory -Path "worktrees" | Out-Null
    }

    git worktree add -b $branchName $worktreePath

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success! Created:" -ForegroundColor Green
        Write-Host "  Branch: $branchName" -ForegroundColor Cyan
        Write-Host "  Path: $worktreePath" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next step:" -ForegroundColor Yellow
        Write-Host "  cd $worktreePath" -ForegroundColor Cyan
        Write-Host ""
    }
}

function Start-Tests {
    Write-Host ""
    Write-Host "Test Workflow" -ForegroundColor Green
    Write-Host ""
    Write-Host "Run tests with:" -ForegroundColor Yellow
    Write-Host "  npm test" -ForegroundColor Cyan
    Write-Host "  npm run lint" -ForegroundColor Cyan
    Write-Host ""
}

switch ($Command) {
    'status' { Show-Status }
    'feature' { New-Feature -FeatureName $Name }
    'test' { Start-Tests }
}
