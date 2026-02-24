# Development Workflow Manager
# AIT42エージェントを活用したシステム開発ワークフロー

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('init', 'feature', 'test', 'deploy', 'status')]
    [string]$Workflow = 'status',

    [Parameter(Mandatory=$false)]
    [string]$FeatureName,

    [Parameter(Mandatory=$false)]
    [string]$Description,

    [Parameter(Mandatory=$false)]
    [switch]$Parallel
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ScriptsDir = $PSScriptRoot

function Show-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  $Title" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Initialize-DevEnvironment {
    Show-Header "Development Environment Initialization"

    Write-Host "🔧 Setting up development environment..." -ForegroundColor Green
    Write-Host ""

    # ディレクトリ構造の作成
    $dirs = @(
        "worktrees",
        "logs",
        "logs/parallel-tasks",
        "logs/agents",
        "tests",
        "docs"
    )

    foreach ($dir in $dirs) {
        $path = Join-Path $ProjectRoot $dir
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Write-Host "✅ Created: $dir" -ForegroundColor Green
        } else {
            Write-Host "📁 Exists: $dir" -ForegroundColor Gray
        }
    }

    Write-Host ""

    # 設定ファイルの作成
    $configPath = Join-Path $ProjectRoot ".claude\dev-config.json"
    if (-not (Test-Path $configPath)) {
        $config = @{
            version = "1.0.0"
            projectName = (Get-Item $ProjectRoot).Name
            agents = @{
                coordinator = "00-ait42-coordinator"
                defaultAgents = @("backend-developer", "frontend-developer", "test-generator")
            }
            worktree = @{
                baseBranch = "main"
                autoCleanup = $true
            }
            parallel = @{
                maxJobs = 4
                timeout = 300
            }
        }
        $config | ConvertTo-Json -Depth 10 | Out-File $configPath -Encoding UTF8
        Write-Host "✅ Created dev-config.json" -ForegroundColor Green
    } else {
        Write-Host "📄 Config exists: dev-config.json" -ForegroundColor Gray
    }

    Write-Host ""

    # Git設定の確認
    Write-Host "🔍 Checking Git configuration..." -ForegroundColor Yellow
    $gitUser = git config user.name
    $gitEmail = git config user.email

    if ($gitUser -and $gitEmail) {
        Write-Host "✅ Git configured: $gitUser <$gitEmail>" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Git user not configured" -ForegroundColor Yellow
        Write-Host "   Run: git config user.name 'Your Name'" -ForegroundColor Cyan
        Write-Host "   Run: git config user.email 'your@email.com'" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "✅ Development environment initialized!" -ForegroundColor Green
    Write-Host ""
}

function Start-FeatureDevelopment {
    param(
        [string]$Feature,
        [string]$Desc
    )

    Show-Header "Feature Development Workflow"

    if (-not $Feature) {
        Write-Host "❌ Feature name is required" -ForegroundColor Red
        Write-Host "Usage: .\dev-workflow.ps1 -Workflow feature -FeatureName 'user-auth' -Description 'User authentication system'" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    # ブランチ名の生成
    $branchName = "feature/$Feature"
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

    Write-Host "🌿 Starting feature development..." -ForegroundColor Green
    Write-Host "   Feature: $Feature" -ForegroundColor Cyan
    Write-Host "   Branch: $branchName" -ForegroundColor Cyan
    if ($Desc) {
        Write-Host "   Description: $Desc" -ForegroundColor Cyan
    }
    Write-Host ""

    # Worktreeの作成
    Write-Host "📂 Creating worktree..." -ForegroundColor Yellow
    & "$ScriptsDir\worktree-manager.ps1" -Action create -BranchName $branchName

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create worktree" -ForegroundColor Red
        return
    }

    # タスク定義の作成
    $taskFile = Join-Path $ProjectRoot ".claude\memory\tasks\$timestamp-$Feature.yaml"
    $descriptionText = if ($Desc) { $Desc } else { 'No description provided' }
    $overviewText = if ($Desc) { $Desc } else { 'Feature development task' }
    $taskContent = @"
---
task_id: $timestamp-$Feature
feature_name: $Feature
description: $descriptionText
branch: $branchName
created_at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
status: in_progress
agents_used: []
milestones:
  - name: Requirements Analysis
    status: pending
  - name: Design
    status: pending
  - name: Implementation
    status: pending
  - name: Testing
    status: pending
  - name: Code Review
    status: pending
---

# Feature Development Task

## Overview
$overviewText

## Workflow
1. Requirements elicitation (requirements-elicitation agent)
2. System design (system-architect, api-designer)
3. Implementation (backend-developer, frontend-developer)
4. Testing (test-generator, integration-tester)
5. Code review (code-reviewer)

## Next Steps
- Analyze requirements
- Create technical design
- Implement features
- Write tests
- Review code
"@

    $taskContent | Out-File $taskFile -Encoding UTF8
    Write-Host "✅ Created task file: $taskFile" -ForegroundColor Green
    Write-Host ""

    # AIT42 Coordinatorの推奨
    Write-Host "🤖 Recommended AIT42 Workflow:" -ForegroundColor Green
    Write-Host ""
    Write-Host "1️⃣  Requirements & Design:" -ForegroundColor Yellow
    Write-Host "   ""$Feature の要件を分析して設計書を作成して""" -ForegroundColor Cyan
    Write-Host "   → Coordinator will select: requirements-elicitation, system-architect" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2️⃣  Implementation:" -ForegroundColor Yellow
    Write-Host "   ""$Feature を実装して""" -ForegroundColor Cyan
    Write-Host "   → Coordinator will select: backend-developer, frontend-developer" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3️⃣  Testing:" -ForegroundColor Yellow
    Write-Host "   ""$Feature のテストを作成して実行して""" -ForegroundColor Cyan
    Write-Host "   → Coordinator will select: test-generator, integration-tester" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4️⃣  Review:" -ForegroundColor Yellow
    Write-Host "   ""コードレビューを実施して""" -ForegroundColor Cyan
    Write-Host "   → Coordinator will select: code-reviewer" -ForegroundColor Gray
    Write-Host ""

    if ($Parallel) {
        Write-Host "⚡ Parallel execution enabled" -ForegroundColor Magenta
        Write-Host "   Multiple agents will run concurrently for faster development" -ForegroundColor Gray
        Write-Host ""
    }
}

function Start-TestWorkflow {
    Show-Header "Testing Workflow"

    Write-Host "🧪 Running test suite..." -ForegroundColor Green
    Write-Host ""

    # テストタスクの定義
    $testTasks = @(
        "npm run test:unit",
        "npm run test:integration",
        "npm run lint",
        "npm run type-check"
    )

    # parallel-tasks.jsonの作成
    $configPath = Join-Path $ProjectRoot ".claude\parallel-tasks.json"
    $config = @{
        tasks = $testTasks
    }
    $config | ConvertTo-Json | Out-File $configPath -Encoding UTF8

    Write-Host "📋 Test tasks configured:" -ForegroundColor Yellow
    foreach ($task in $testTasks) {
        Write-Host "   - $task" -ForegroundColor Cyan
    }
    Write-Host ""

    Write-Host "🚀 To run tests in parallel:" -ForegroundColor Green
    Write-Host "   .\scripts\parallel-runner.ps1 -Action start" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 To check test status:" -ForegroundColor Green
    Write-Host "   .\scripts\parallel-runner.ps1 -Action status" -ForegroundColor Cyan
    Write-Host ""
}

function Start-DeployWorkflow {
    Show-Header "Deployment Workflow"

    Write-Host "🚀 Deployment workflow..." -ForegroundColor Green
    Write-Host ""

    Write-Host "🤖 Recommended AIT42 Agents:" -ForegroundColor Yellow
    Write-Host "   - devops-engineer: CI/CD configuration" -ForegroundColor Cyan
    Write-Host "   - release-manager: Release preparation" -ForegroundColor Cyan
    Write-Host "   - security-scanner: Security validation" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "📋 Deployment Checklist:" -ForegroundColor Green
    Write-Host "   ☐ All tests passing" -ForegroundColor White
    Write-Host "   ☐ Code review completed" -ForegroundColor White
    Write-Host "   ☐ Security scan clean" -ForegroundColor White
    Write-Host "   ☐ Documentation updated" -ForegroundColor White
    Write-Host "   ☐ Rollback plan ready" -ForegroundColor White
    Write-Host ""

    Write-Host "💡 Use Claude Code:" -ForegroundColor Yellow
    Write-Host "   ""デプロイの準備を整えて""" -ForegroundColor Cyan
    Write-Host ""
}

function Show-WorkflowStatus {
    Show-Header "Development Status"

    # Git status
    Write-Host "📊 Git Status:" -ForegroundColor Green
    Write-Host ""
    git status --short
    Write-Host ""

    # Worktrees
    Write-Host "🌿 Active Worktrees:" -ForegroundColor Green
    Write-Host ""
    & "$ScriptsDir\worktree-manager.ps1" -Action status

    # Recent tasks
    $tasksDir = Join-Path $ProjectRoot ".claude\memory\tasks"
    if (Test-Path $tasksDir) {
        Write-Host "📝 Recent Tasks:" -ForegroundColor Green
        Write-Host ""
        $tasks = Get-ChildItem $tasksDir -Filter "*.yaml" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
        if ($tasks) {
            foreach ($task in $tasks) {
                Write-Host "   $($task.Name)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "   (no tasks)" -ForegroundColor Gray
        }
        Write-Host ""
    }

    # AIT42 agents
    Write-Host "🤖 Available AIT42 Agents:" -ForegroundColor Green
    $agentsDir = Join-Path $ProjectRoot ".claude\agents"
    $agentCount = (Get-ChildItem $agentsDir -Filter "*.md").Count
    Write-Host "   Total: $agentCount agents" -ForegroundColor Cyan
    Write-Host "   Coordinator: 00-ait42-coordinator" -ForegroundColor Yellow
    Write-Host ""
}

# Main execution
switch ($Workflow) {
    'init' {
        Initialize-DevEnvironment
    }
    'feature' {
        Start-FeatureDevelopment -Feature $FeatureName -Desc $Description
    }
    'test' {
        Start-TestWorkflow
    }
    'deploy' {
        Start-DeployWorkflow
    }
    'status' {
        Show-WorkflowStatus
    }
}
