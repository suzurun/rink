# Claude Code開発プロジェクト

AIT42エージェントシステムを活用したシステム開発環境

## 🚀 クイックスタート

### 環境確認

```powershell
# 開発環境の状態確認
.\scripts\quickstart.ps1 -Command status
```

### 新機能開発の開始

```powershell
# 新しい機能ブランチとWorktreeを作成
.\scripts\quickstart.ps1 -Command feature -Name "user-auth"

# Worktreeに移動
cd worktrees/user-auth

# Claude Codeで開発開始
# 例: "ユーザー認証システムを実装して"
```

## 📁 プロジェクト構成

```
test/
├── .claude/
│   ├── agents/              # AIT42エージェント (60個)
│   │   └── 00-ait42-coordinator.md
│   ├── commands/            # スラッシュコマンド
│   ├── memory/              # 長期メモリシステム
│   └── dev-config.json      # 開発設定
├── scripts/
│   ├── quickstart.ps1       # クイックスタートスクリプト
│   ├── dev-workflow.ps1     # 完全な開発ワークフロー
│   ├── worktree-manager.ps1 # Worktree管理
│   └── parallel-runner.ps1  # 並列タスク実行
├── worktrees/               # 機能開発用ディレクトリ
├── logs/                    # 実行ログ
└── DEV-ENVIRONMENT.md       # 詳細ドキュメント
```

## 🤖 AIT42エージェント

### 自動エージェント選択（推奨）

Claude Codeで自然言語のタスクを指示するだけで、Coordinatorが最適なエージェントを自動選択します。

```
"ECサイトのバックエンドAPIを設計して実装して"
```

→ Coordinatorが以下を自動実行：
1. system-architect（システム設計）
2. api-designer（API設計）
3. backend-developer（実装）

### 利用可能なエージェント（全60個）

**Planning Pod（計画）**
- system-architect, api-designer, database-designer
- security-architect, cloud-architect, ui-ux-designer
- requirements-elicitation, integration-planner

**Implementation Pod（実装）**
- backend-developer, frontend-developer, api-developer
- database-developer, feature-builder, integration-developer

**QA Pod（品質保証）**
- code-reviewer, test-generator, integration-tester
- security-tester, performance-tester, bug-fixer

**Operations Pod（運用）**
- devops-engineer, cicd-manager, monitoring-specialist
- incident-responder, release-manager

**Meta Pod（メタ管理）**
- workflow-coordinator, learning-agent, metrics-collector

## 💡 使用例

### 例1: ユーザー認証機能の開発

```powershell
# 1. 機能ブランチ作成
.\scripts\quickstart.ps1 -Command feature -Name "user-auth"
cd worktrees/user-auth

# 2. Claude Codeで開発
# "JWT認証とOAuth2.0に対応したユーザー認証システムを実装して"

# 3. テスト実行
npm test

# 4. メインブランチにマージ
cd ../..
git checkout main
git merge feature/user-auth
```

### 例2: 並列開発

```powershell
# 複数の機能を同時開発
.\scripts\quickstart.ps1 -Command feature -Name "user-auth"
.\scripts\quickstart.ps1 -Command feature -Name "product-catalog"
.\scripts\quickstart.ps1 -Command feature -Name "payment-system"

# 各Worktreeで独立して作業可能
cd worktrees/user-auth      # 認証機能の開発
cd worktrees/product-catalog # 商品管理の開発
cd worktrees/payment-system  # 決済機能の開発
```

## 🛠️ スクリプトリファレンス

### quickstart.ps1（推奨）

シンプルで使いやすいクイックスタートスクリプト

```powershell
# 状態確認
.\scripts\quickstart.ps1 -Command status

# 機能開発開始
.\scripts\quickstart.ps1 -Command feature -Name "feature-name"

# テストワークフロー
.\scripts\quickstart.ps1 -Command test
```

### dev-workflow.ps1（高度な機能）

完全な開発ワークフロー管理

```powershell
# 環境初期化
.\scripts\dev-workflow.ps1 -Workflow init

# 機能開発（詳細設定付き）
.\scripts\dev-workflow.ps1 -Workflow feature `
    -FeatureName "user-auth" `
    -Description "JWT認証システム"

# 開発状況確認
.\scripts\dev-workflow.ps1 -Workflow status
```

### parallel-runner.ps1（並列実行）

複数タスクの並列実行

```powershell
# 並列実行
.\scripts\parallel-runner.ps1 -Action start -Tasks @(
    "npm run build",
    "npm run lint",
    "npm test"
)

# 実行状況確認
.\scripts\parallel-runner.ps1 -Action status
```

## 📚 ドキュメント

詳細な使い方は以下を参照してください：

- **[DEV-ENVIRONMENT.md](./DEV-ENVIRONMENT.md)** - 開発環境の完全ガイド
  - 詳細なワークフロー
  - スクリプトのすべてのオプション
  - トラブルシューティング
  - ベストプラクティス

## ⚙️ 必要な環境

- Windows 10/11
- PowerShell 5.1以上
- Git 2.23以上（Worktree対応）
- Node.js 18以上（プロジェクトに応じて）

## 🔧 トラブルシューティング

### PowerShell実行ポリシーエラー

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Worktree作成エラー

```powershell
# 既存ブランチの確認
git branch -a

# 既存ブランチの削除（必要な場合）
git branch -d feature/old-feature
```

### エージェントが動作しない

```powershell
# エージェントファイルの確認
Get-ChildItem .claude/agents/ | Select-Object Name | Select-Object -First 5

# Coordinatorの確認
Test-Path .claude/agents/00-ait42-coordinator.md
```

## 🎯 次のステップ

1. **環境確認**: `.\scripts\quickstart.ps1 -Command status`
2. **機能開発開始**: `.\scripts\quickstart.ps1 -Command feature -Name "your-feature"`
3. **Claude Codeで開発**: 自然言語でタスクを指示
4. **詳細ドキュメント参照**: [DEV-ENVIRONMENT.md](./DEV-ENVIRONMENT.md)

## 📞 サポート

- **詳細ガイド**: [DEV-ENVIRONMENT.md](./DEV-ENVIRONMENT.md)
- **AIT42ドキュメント**: `.claude/memory/README.md`
- **Claude Codeに質問**: "○○について教えて"

---

**準備完了！開発を始めましょう！**

```powershell
.\scripts\quickstart.ps1 -Command status
```
