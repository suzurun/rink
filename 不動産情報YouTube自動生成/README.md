# Real Estate Video Automation - AIT42 + Worktree + TMUX Integration

AI駆動の並列タスク実行システム。AIT42エージェント選択、Git Worktree分離、TMUX並列実行を統合。

## 機能

### 1. AIT42 Coordinator
- タスク分析と複雑度評価
- 最適なエージェント選択（49種のスペシャリストから1-3名）
- 並列実行戦略の計画

### 2. Worktree Manager
- Git worktreeによる作業環境の分離
- 競合のない並列開発
- ブランチ管理の自動化

### 3. TMUX Session Manager
- 複数エージェント用のセッション管理
- 独立したワークスペース（4ウィンドウ）
- コマンド送信とモニタリング

## アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│           AIT42 Coordinator                          │
│  ┌──────────────────────────────────────┐           │
│  │  Task Analysis                        │           │
│  │  - Complexity Assessment              │           │
│  │  - Requirement Extraction             │           │
│  │  - Agent Count Estimation             │           │
│  └──────────────────────────────────────┘           │
│  ┌──────────────────────────────────────┐           │
│  │  Agent Selection (Top 1-3)            │           │
│  │  - Score Calculation                  │           │
│  │  - Capability Matching                │           │
│  │  - Priority Weighting                 │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           Worktree Manager                           │
│  ┌──────────────────────────────────────┐           │
│  │  Create Isolated Workspace            │           │
│  │  - Branch Creation/Checkout           │           │
│  │  - Directory Management               │           │
│  │  - No Conflict Execution              │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           TMUX Session Manager                       │
│  ┌──────────────┬──────────────┬──────────────┐    │
│  │  Window 0:   │  Window 1:   │  Window 2:   │    │
│  │  main        │  agent-1     │  agent-2     │    │
│  └──────────────┴──────────────┴──────────────┘    │
│  ┌──────────────────────────────────────┐           │
│  │  Window 3: logs                      │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

## インストール

```bash
# 依存関係のインストール
npm install

# TypeScriptビルド
npm run build
```

### 必要な環境

- Node.js 18+
- Git 2.30+
- tmux 3.0+ (オプション、Windows環境では不要な場合あり)

## 使い方

### クイックスタート

```bash
# システムステータス確認
npm run dev status

# タスクを実行（自動でworktree + tmuxセッション作成）
npm run dev execute "Design a REST API for real estate management"
```

### 個別コンポーネントの使用

#### AIT42 Coordinator

```bash
# タスク分析とエージェント選択
npm run ait42 "Implement user authentication with JWT"
```

出力例:
```
Task Analysis:
  Description: Implement user authentication with JWT
  Complexity: medium
  Requirements: API Development, Security Implementation
  Estimated Agents: 2

Selected Agents:
1. Senior API Developer (Score: 25.5)
   REST/GraphQL/gRPC implementation with authentication
   Reason: Expert in authentication - directly matches task requirements

2. Principal Security Architect (Score: 24.2)
   Enterprise security design with threat modeling
   Reason: Expert in security - directly matches task requirements
```

#### Worktree Manager

```bash
# ワークツリーの作成
npm run worktree:create my-feature feature/my-feature

# ワークツリー一覧
npm run worktree:list

# ワークツリー削除
npm run worktree:remove my-feature
```

#### TMUX Session Manager

```bash
# セッション作成
npm run tmux:create my-session /path/to/worktree

# セッション一覧
npm run tmux:list

# セッションにアタッチ
tmux attach-session -t my-session

# セッション削除
npm run tmux:kill my-session
```

### 統合実行フロー

```bash
# 1. タスクを実行（全自動）
npm run dev execute "Build a property search API with filters"

# 出力：
# - タスク分析
# - エージェント選択
# - ワークツリー作成
# - TMUXセッション作成
# - アタッチコマンド表示

# 2. TMUXセッションにアタッチ
tmux attach-session -t task-1234567890

# 3. 作業完了後、クリーンアップ
npm run dev cleanup task-1234567890 task-1234567890
```

## プロジェクト構造

```
.
├── src/
│   ├── ait42/
│   │   ├── coordinator.ts          # メインコーディネーター
│   │   └── agents-registry.ts      # エージェント定義（49種）
│   ├── worktree/
│   │   └── manager.ts              # Git worktree管理
│   ├── tmux/
│   │   └── session-manager.ts      # TMUXセッション管理
│   ├── types/
│   │   └── index.ts                # 型定義
│   ├── utils/
│   │   └── logger.ts               # ロギング
│   └── index.ts                    # 統合システム
├── test-integration.sh             # 統合テストスクリプト
├── package.json
├── tsconfig.json
└── README.md
```

## エージェント一覧（抜粋）

システムは以下のような専門エージェントを含む49種のエージェントから最適な組み合わせを選択します：

- **api-designer**: API設計（REST, GraphQL, OpenAPI）
- **backend-developer**: バックエンド実装
- **frontend-developer**: フロントエンド実装
- **database-designer**: データベース設計
- **system-architect**: システムアーキテクチャ
- **security-architect**: セキュリティ設計
- **devops-engineer**: DevOps・インフラ
- **test-generator**: テスト自動生成
- **code-reviewer**: コードレビュー

各エージェントは専門性、優先度、ケイパビリティでスコアリングされます。

## 統合テスト

```bash
# 全機能の統合テストを実行
bash test-integration.sh
```

テスト項目：
1. 依存関係のインストール
2. TypeScriptビルド
3. AIT42 Coordinator動作確認
4. Worktree Manager動作確認
5. TMUX Session Manager動作確認
6. 統合システム動作確認

## トラブルシューティング

### tmuxが見つからない

Windows環境でtmuxが利用できない場合：
- WSL2をインストールしてLinux環境で実行
- またはtmux機能を除いた運用も可能（worktreeのみ使用）

### worktree作成エラー

```bash
# 既存のworktreeをクリーンアップ
git worktree prune
npm run worktree:list
```

### TypeScriptビルドエラー

```bash
# node_modulesを再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

## ライセンス

MIT

## 将来の拡張

- [ ] nanobanana API統合（動画生成自動化）
- [ ] Airtable連携（物件データ管理）
- [ ] Make.com連携（ワークフロー自動化）
- [ ] エージェント実行結果の自動マージ
- [ ] CI/CD統合
