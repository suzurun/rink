# Git Worktree Manager for Claude Code Development
# AIT42エージェントと連携した開発ブランチ管理

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('create', 'list', 'remove', 'status')]
    [string]$Action = 'list',

    [Parameter(Mandatory=$false)]
    [string]$BranchName,

    [Parameter(Mandatory=$false)]
    [string]$BaseBranch = 'main',

    [Parameter(Mandatory=$false)]
    [string]$WorktreePath
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$WorktreesDir = Join-Path $ProjectRoot "worktrees"

function Show-Header {
    Write-Host ""
    Write-Host "=== Git Worktree Manager for Claude Code ===" -ForegroundColor Cyan
    Write-Host ""
}

function Get-WorktreeList {
    Write-Host "📂 Active Worktrees:" -ForegroundColor Green
    Write-Host ""

    $worktrees = git worktree list --porcelain
    if ($LASTEXITCODE -eq 0) {
        $worktrees
    } else {
        Write-Host "⚠️  No worktrees found or git error occurred" -ForegroundColor Yellow
    }
    Write-Host ""
}

function New-DevelopmentWorktree {
    param(
        [string]$Branch,
        [string]$Base,
        [string]$Path
    )

    if (-not $Branch) {
        Write-Host "❌ Error: Branch name is required" -ForegroundColor Red
        Write-Host "Usage: .\worktree-manager.ps1 -Action create -BranchName 'feature/new-feature'" -ForegroundColor Yellow
        return
    }

    # Worktreeパスの決定
    if (-not $Path) {
        $safeBranchName = $Branch -replace '[/\\:]', '-'
        $Path = Join-Path $WorktreesDir $safeBranchName
    }

    Write-Host "🌿 Creating new worktree..." -ForegroundColor Green
    Write-Host "   Branch: $Branch" -ForegroundColor Cyan
    Write-Host "   Base: $Base" -ForegroundColor Cyan
    Write-Host "   Path: $Path" -ForegroundColor Cyan
    Write-Host ""

    # ディレクトリ作成
    if (-not (Test-Path $WorktreesDir)) {
        New-Item -ItemType Directory -Path $WorktreesDir | Out-Null
        Write-Host "✅ Created worktrees directory: $WorktreesDir" -ForegroundColor Green
    }

    # Worktree作成
    git worktree add -b $Branch $Path $Base

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Worktree created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📍 Next steps:" -ForegroundColor Yellow
        Write-Host "   cd $Path" -ForegroundColor Cyan
        Write-Host "   # Start development with AIT42 agents" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Failed to create worktree" -ForegroundColor Red
        Write-Host ""
    }
}

function Remove-DevelopmentWorktree {
    param(
        [string]$Path
    )

    if (-not $Path) {
        Write-Host "❌ Error: Worktree path is required" -ForegroundColor Red
        Write-Host "Usage: .\worktree-manager.ps1 -Action remove -WorktreePath 'worktrees/feature-branch'" -ForegroundColor Yellow
        return
    }

    Write-Host "🗑️  Removing worktree: $Path" -ForegroundColor Yellow
    Write-Host ""

    git worktree remove $Path

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Worktree removed successfully!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Failed to remove worktree" -ForegroundColor Red
        Write-Host "   Try: git worktree remove --force $Path" -ForegroundColor Yellow
        Write-Host ""
    }
}

function Show-WorktreeStatus {
    Write-Host "📊 Worktree Status:" -ForegroundColor Green
    Write-Host ""

    $worktrees = git worktree list
    if ($LASTEXITCODE -eq 0) {
        $worktrees | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Cyan
        }
    }
    Write-Host ""

    Write-Host "📂 Worktrees Directory:" -ForegroundColor Green
    if (Test-Path $WorktreesDir) {
        $items = Get-ChildItem $WorktreesDir -Directory
        if ($items) {
            $items | ForEach-Object {
                Write-Host "  $($_.Name)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "  (empty)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  (not created)" -ForegroundColor Gray
    }
    Write-Host ""
}

# Main execution
Show-Header

switch ($Action) {
    'create' {
        New-DevelopmentWorktree -Branch $BranchName -Base $BaseBranch -Path $WorktreePath
    }
    'list' {
        Get-WorktreeList
    }
    'remove' {
        Remove-DevelopmentWorktree -Path $WorktreePath
    }
    'status' {
        Show-WorktreeStatus
    }
}
