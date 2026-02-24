# Claude Code開発環境ガイド

AIT42エージェントを活用したシステム開発のための環境設定とワークフローガイド

## 📋 目次

1. [環境概要](#環境概要)
2. [初期セットアップ](#初期セットアップ)
3. [ワークフロー](#ワークフロー)
4. [スクリプトリファレンス](#スクリプトリファレンス)
5. [AIT42エージェント活用](#ait42エージェント活用)
6. [トラブルシューティング](#トラブルシューティング)

---

## 環境概要

### システム構成

```
test/
├── .claude/
│   ├── agents/              # AIT42エージェント定義 (55個)
│   │   ├── 00-ait42-coordinator.md
│   │   └── [各種専門エージェント]
│   ├── commands/            # スラッシュコマンド
│   ├── memory/              # 長期メモリシステム
│   │   ├── tasks/          # タスク履歴
│   │   ├── agents/         # エージェント統計
│   │   └── sop-templates/  # 標準作業手順書
│   └── dev-config.json     # 開発環境設定
├── scripts/
│   ├── worktree-manager.ps1    # Git Worktree管理
│   ├── parallel-runner.ps1     # 並列タスク実行
│   └── dev-workflow.ps1        # 開発ワークフロー管理
├── worktrees/              # 機能開発用Worktree
├── logs/                   # 実行ログ
└── tests/                  # テストコード
```

### 主要機能

1. **Git Worktree管理** - 機能ごとに独立した作業ディレクトリ
2. **並列タスク実行** - PowerShellジョブによる並列処理
3. **AIT42エージェント統合** - 55個の専門エージェントによる自動タスク処理
4. **長期メモリシステム** - タスク履歴とエージェント学習

---

## 初期セットアップ

### 1. 環境初期化

```powershell
# 開発環境の初期化
.\scripts\dev-workflow.ps1 -Workflow init
```

これにより以下が作成されます：
- 必要なディレクトリ構造
- 開発設定ファイル (`.claude/dev-config.json`)
- Git設定の確認

### 2. Git設定の確認

```powershell
# ユーザー情報が未設定の場合
git config user.name "Your Name"
git config user.email "your@email.com"
```

### 3. Node.js依存関係のインストール（プロジェクトに応じて）

```powershell
npm install
```

---

## ワークフロー

### 機能開発ワークフロー

#### 1. 新機能の開始

```powershell
# 機能開発用ブランチとWorktreeを作成
.\scripts\dev-workflow.ps1 -Workflow feature `
    -FeatureName "user-auth" `
    -Description "ユーザー認証システムの実装"
```

**実行結果：**
- `feature/user-auth` ブランチ作成
- `worktrees/feature-user-auth/` ディレクトリ作成
- タスクファイル生成 (`.claude/memory/tasks/`)
- AIT42推奨ワークフロー表示

#### 2. 要件分析と設計

Claude Codeで以下を実行：

```
"user-auth の要件を分析して設計書を作成して"
```

**Coordinatorが自動選択するエージェント：**
- `requirements-elicitation` - 要件引き出し
- `system-architect` - システムアーキテクチャ設計
- `api-designer` - API設計

#### 3. 実装

```
"user-auth を実装して"
```

**Coordinatorが自動選択するエージェント：**
- `backend-developer` - バックエンド実装
- `frontend-developer` - フロントエンド実装
- `database-developer` - データベース設計・実装

#### 4. テスト作成・実行

```
"user-auth のテストを作成して実行して"
```

**Coordinatorが自動選択するエージェント：**
- `test-generator` - テストコード生成
- `integration-tester` - 統合テスト実行
- `security-tester` - セキュリティテスト

#### 5. コードレビュー

```
"コードレビューを実施して"
```

**Coordinatorが自動選択するエージェント：**
- `code-reviewer` - コード品質評価
- `reflection-agent` - 品質ゲーティング（自動）

---

### 並列タスク実行

#### テストの並列実行

```powershell
# テストワークフローの設定
.\scripts\dev-workflow.ps1 -Workflow test

# 並列実行
.\scripts\parallel-runner.ps1 -Action start

# 実行状況確認
.\scripts\parallel-runner.ps1 -Action status

# ログ確認
.\scripts\parallel-runner.ps1 -Action logs -ShowLogs
```

#### カスタムタスクの並列実行

```powershell
.\scripts\parallel-runner.ps1 -Action start -Tasks @(
    "npm run build",
    "npm run lint",
    "npm run test:unit"
) -MaxParallel 3
```

---

### Git Worktree管理

#### Worktree一覧

```powershell
.\scripts\worktree-manager.ps1 -Action list
```

#### Worktree作成（手動）

```powershell
.\scripts\worktree-manager.ps1 -Action create `
    -BranchName "feature/new-feature" `
    -BaseBranch "main"
```

#### Worktree削除

```powershell
.\scripts\worktree-manager.ps1 -Action remove `
    -WorktreePath "worktrees/feature-new-feature"
```

#### Worktreeステータス確認

```powershell
.\scripts\worktree-manager.ps1 -Action status
```

---

## スクリプトリファレンス

### dev-workflow.ps1

**用途：** 開発ワークフロー全体の管理

**コマンド：**

```powershell
# 環境初期化
.\scripts\dev-workflow.ps1 -Workflow init

# 機能開発開始
.\scripts\dev-workflow.ps1 -Workflow feature -FeatureName "機能名" -Description "説明"

# テストワークフロー
.\scripts\dev-workflow.ps1 -Workflow test

# デプロイワークフロー
.\scripts\dev-workflow.ps1 -Workflow deploy

# 開発状況確認
.\scripts\dev-workflow.ps1 -Workflow status
```

### worktree-manager.ps1

**用途：** Git Worktreeの作成・管理

**コマンド：**

```powershell
# Worktree作成
.\scripts\worktree-manager.ps1 -Action create -BranchName "branch-name"

# Worktree一覧
.\scripts\worktree-manager.ps1 -Action list

# Worktree削除
.\scripts\worktree-manager.ps1 -Action remove -WorktreePath "path"

# ステータス確認
.\scripts\worktree-manager.ps1 -Action status
```

### parallel-runner.ps1

**用途：** タスクの並列実行とモニタリング

**コマンド：**

```powershell
# 並列実行開始
.\scripts\parallel-runner.ps1 -Action start -Tasks @("task1", "task2")

# 設定ファイルから実行
.\scripts\parallel-runner.ps1 -Action start -ConfigFile ".claude/parallel-tasks.json"

# ステータス確認
.\scripts\parallel-runner.ps1 -Action status

# ログ確認
.\scripts\parallel-runner.ps1 -Action logs -ShowLogs

# 全タスク停止
.\scripts\parallel-runner.ps1 -Action stop
```

---

## AIT42エージェント活用

### エージェント構成

**5つの機能ポッド（全55エージェント）：**

1. **Planning Pod（計画）**
   - system-architect, api-designer, database-designer, ui-ux-designer
   - security-architect, cloud-architect, integration-planner
   - requirements-elicitation

2. **Implementation Pod（実装）**
   - backend-developer, frontend-developer, api-developer
   - database-developer, feature-builder, integration-developer
   - migration-developer, script-writer, implementation-assistant

3. **QA Pod（品質保証）**
   - code-reviewer, test-generator, integration-tester
   - performance-tester, security-tester, mutation-tester
   - qa-validator, refactor-specialist, complexity-analyzer
   - doc-reviewer, bug-fixer

4. **Operations Pod（運用）**
   - devops-engineer, cicd-manager, container-specialist
   - monitoring-specialist, incident-responder, security-scanner
   - backup-manager, chaos-engineer, release-manager
   - config-manager

5. **Meta Pod（メタ管理）**
   - process-optimizer, workflow-coordinator, learning-agent
   - feedback-analyzer, metrics-collector, knowledge-manager
   - innovation-scout, tech-writer

### Coordinatorの使い方

#### 自動エージェント選択（推奨）

```
# Coordinatorが最適なエージェントを自動選択
"ECサイトのバックエンドAPIを実装して"
```

→ Coordinatorが以下を判断：
- タスクの種類（実装タスク）
- 必要なスキル（バックエンド、API）
- 最適なエージェント（backend-developer, api-developer）

#### 手動エージェント指定

```
# 特定のエージェントを直接指定
"backend-developerで、ユーザー認証APIを実装して"
```

#### 並列実行（Coordinator自動管理）

```
# 複数タスクを並列実行
"ECサイトのシステムを設計して実装してテストして"
```

→ Coordinatorが自動的に：
1. タスクを分解
2. 複数エージェントを並列起動
3. 依存関係を管理
4. 結果を統合

### メモリシステムの活用

#### タスク履歴の確認

```powershell
# 最近のタスク履歴
Get-ChildItem .claude/memory/tasks/ | Sort-Object LastWriteTime -Descending | Select-Object -First 10
```

#### エージェント統計の確認

```powershell
# エージェントのパフォーマンス統計
Get-Content .claude/memory/agents/backend-developer-stats.yaml
```

#### 標準作業手順書（SOP）の参照

```powershell
# 機能開発のSOP
Get-Content .claude/memory/sop-templates/feature_development.md

# バグ修正のSOP
Get-Content .claude/memory/sop-templates/bug_fix.md

# デプロイのSOP
Get-Content .claude/memory/sop-templates/deployment.md
```

---

## 実践例

### 例1: 新機能開発（ユーザー認証）

```powershell
# 1. 機能開発開始
.\scripts\dev-workflow.ps1 -Workflow feature `
    -FeatureName "user-auth" `
    -Description "JWT認証とOAuth2.0対応"

# 2. Worktreeに移動
cd worktrees/feature-user-auth

# 3. Claude Codeで要件分析
# "user-auth の要件を分析して、セキュリティを考慮した設計書を作成して"

# 4. 実装
# "設計書に基づいてユーザー認証APIを実装して"

# 5. テスト作成・実行
# "認証APIの統合テストとセキュリティテストを作成して実行して"

# 6. コードレビュー
# "認証機能のコードレビューを実施して"

# 7. 元のディレクトリに戻る
cd ../..

# 8. マージ（レビュー完了後）
git checkout main
git merge feature/user-auth
```

### 例2: 並列テスト実行

```powershell
# 1. テストワークフロー設定
.\scripts\dev-workflow.ps1 -Workflow test

# 2. 並列実行
.\scripts\parallel-runner.ps1 -Action start -MaxParallel 4

# 3. リアルタイムモニタリング
while ($true) {
    Clear-Host
    .\scripts\parallel-runner.ps1 -Action status
    Start-Sleep -Seconds 5
}
```

### 例3: 複数機能の同時開発

```powershell
# 機能A: ユーザー認証
.\scripts\dev-workflow.ps1 -Workflow feature -FeatureName "user-auth"

# 機能B: 商品管理
.\scripts\dev-workflow.ps1 -Workflow feature -FeatureName "product-management"

# 機能C: 決済システム
.\scripts\dev-workflow.ps1 -Workflow feature -FeatureName "payment-system"

# Worktree一覧確認
.\scripts\worktree-manager.ps1 -Action list

# 各Worktreeで独立して開発可能
cd worktrees/feature-user-auth
# 開発作業...

cd ../feature-product-management
# 開発作業...
```

---

## トラブルシューティング

### PowerShell実行ポリシーエラー

```powershell
# エラー: スクリプトの実行が無効になっている
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Worktree作成失敗

```powershell
# ブランチが既に存在する場合
git branch -d feature/existing-branch
.\scripts\worktree-manager.ps1 -Action create -BranchName "feature/existing-branch"

# または既存ブランチを使用
git worktree add worktrees/existing-branch feature/existing-branch
```

### 並列実行ジョブが残っている

```powershell
# 全ジョブの確認
Get-Job

# 全ジョブの停止とクリーンアップ
Get-Job | Stop-Job
Get-Job | Remove-Job

# またはスクリプト経由
.\scripts\parallel-runner.ps1 -Action stop
```

### AIT42 Coordinatorが応答しない

```powershell
# エージェントファイルの確認
Get-ChildItem .claude/agents/ | Select-Object Name | Where-Object { $_.Name -like "*coordinator*" }

# 期待される出力: 00-ait42-coordinator.md

# ファイルが存在しない場合は再インストール
# (AIT42のインストール手順を再実行)
```

### メモリシステムのエラー

```powershell
# 設定ファイルの確認
Test-Path .claude/memory/config.yaml

# ディレクトリ構造の再作成
.\scripts\dev-workflow.ps1 -Workflow init
```

---

## パフォーマンス最適化

### 並列実行の最適化

```powershell
# CPUコア数に基づく最大並列数の設定
$cores = (Get-WmiObject Win32_Processor).NumberOfLogicalProcessors
.\scripts\parallel-runner.ps1 -Action start -MaxParallel $cores
```

### Git Worktreeのクリーンアップ

```powershell
# 古いWorktreeの削除
git worktree prune

# 不要なWorktreeの一括削除
Get-ChildItem worktrees/ -Directory | ForEach-Object {
    git worktree remove $_.FullName
}
```

### ログのアーカイブ

```powershell
# 30日以上前のログを圧縮
$archiveDate = (Get-Date).AddDays(-30)
Get-ChildItem logs/ -Recurse -File | Where-Object {
    $_.LastWriteTime -lt $archiveDate
} | Compress-Archive -DestinationPath "logs/archive-$(Get-Date -Format 'yyyyMMdd').zip"
```

---

## ベストプラクティス

### 1. 機能開発の粒度

- **小さく分割**: 1機能 = 1 Worktree
- **明確な命名**: `feature/user-auth` > `feature/new-stuff`
- **定期的なマージ**: 長期ブランチを避ける

### 2. AIT42エージェントの活用

- **Coordinatorを信頼**: 手動選択は最小限に
- **説明を明確に**: "○○を実装して" より "△△の要件で○○を実装して"
- **段階的実行**: 設計 → 実装 → テスト → レビュー

### 3. 並列実行の活用

- **独立タスク**: 依存関係のないタスクを並列化
- **リソース管理**: MaxParallelをCPUコア数以下に
- **ログ監視**: 定期的にログを確認

### 4. メモリシステムの維持

- **タスク記録**: 重要な開発タスクは手動で記録
- **統計確認**: エージェントのパフォーマンスを定期確認
- **SOP準拠**: 標準作業手順書に従う

---

## まとめ

この開発環境により以下が実現できます：

✅ **効率的な機能開発** - Git Worktreeによる並行開発
✅ **自動タスク処理** - AIT42エージェントの活用
✅ **並列実行** - PowerShellジョブによる高速化
✅ **品質保証** - 自動レビューとテスト
✅ **学習システム** - タスク履歴による継続的改善

**準備完了です！開発を始めましょう。**

---

## サポート

問題が発生した場合：

1. このドキュメントの「トラブルシューティング」セクションを確認
2. `.claude/memory/README.md` でメモリシステムの詳細を確認
3. AIT42の公式ドキュメント（README.md）を参照
4. Claude Codeに直接質問: "開発環境で○○のエラーが発生しています"

---

**作成日**: 2025-11-19
**バージョン**: 1.0.0
**対応環境**: Windows + PowerShell + Git + Node.js
**AIT42バージョン**: v1.4.0+
