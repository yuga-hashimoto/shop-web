# CI/CD・データ発掘ジョブの自動運用設計

**更新日：2026-10-26 / 初期実装：MOCKのみ**

## 1. 現在動くもの・未実装のもの

| 機能 | 状態 |
|---|---|
| GitHub Actions CI（push / PR / 手動） | 実装済み |
| 6時間おきのScheduled workflow | 実装済み（既定ブランチに設定後稼働） |
| 架空の相場データによる費用計算 | 実装済み |
| データ権限チェックの基本純粋関数 | 実装済み・ユニットテストあり |
| 結果JSONのArtifact保存 | 実装済み（7日） |
| メルカリの実データ自動収集 | **未実装・未許諾・無効** |
| eBayの実売データ自動収集 | **未実装・未許諾・無効** |
| LLMによる商品候補探索・型番判定 | 未実装 |
| PostgreSQL保存、Webサイト公開、Pro決済 | 未実装 |
| 本番通知、監視、デプロイ | 未実装 |

現在の定期実行は、実データの収集ジョブではなく**パイプラインが動作するかの検証**。運用モードを文字列変更しただけでは実データ収集が動かないよう、`MOCK`以外は即失敗する。

## 2. 目標アーキテクチャ

```text
GitHub Actions schedule (dispatcher)
  └─ Approval/Quota Gate (fail closed)
      └─ Workflow orchestration (idempotent run_id)
          ├─ Discovery Agent (candidate models)
          ├─ Authorized Source Adapters (Mercari / eBay / licensed data)
          ├─ Normalization + Matching Agent (strict product variants)
          ├─ Pricing Worker (deterministic)
          ├─ Quality / Rights Gate (confidence & evidence)
          ├─ Postgres (products, prices, provenance, entitlements)
          ├─ Publishing Worker (Free/Pro via server-side auth)
          └─ Notification Worker (deduplicated Pro alerts)
```

AI/LLMは文章や属性の判断に使い、実売価格、送料、レート、手数料、ROI、利用許可などを推測で埋めない。プロバイダー差し替え可能なGatewayにする。

## 3. 具体的なジョブスケジュール

| 種類 | 提案頻度 | 依存関係 |
|---|---|---|
| CI（lint / tests） | push / PR | 常時 |
| Discovery（候補型番） | 1日1回 | LLM費用枠とカテゴリ |
| Active listing refresh | 6時間ごと | 自動取得の許諾とAPI枠 |
| eBay sold research | 1日1回 | 商用取得・派生統計・AI入力の許諾 |
| FX/fees/shipping | 1日1回 | 信頼できる情報源 |
| Pro publication & notifications | 収集完了イベント後 | 権限・品質・認可・配信同意 |
| License/heartbeat alert | 1日1回 | 許諾台帳・ジョブ実行履歴 |

**初期の実装**：`.github/workflows/auto-discovery.yml` はUTC 01:17 / 07:17 / 13:17 / 19:17。日本時間 10:17 / 16:17 / 22:17 / 翌04:17。実行時間が厳密である保証はない。手動実行はActionsの`workflow_dispatch`を使う。

## 4. GitHub Actionsを使うときの重要な制約

- GitHub FreeのPrivateリポジトリには標準GitHub-hosted runner月2,000分の無料枠がある（プランにより異なる）。Publicでは標準runnerの実行分は無料。ただし大きなrunnerや外部AI/API/DBの課金が無料になるわけではない。
- 例：6時間に1回、各10分のジョブは最大で約1,200分/月。CIや再実行にも枠が必要。実コストはActions Usageで確認。
- GitHub Actions scheduleは**遅延・スキップがありうる**。5分刻みの低遅延通知や高頻度在庫同期のSLAには不向き。必要になったら専用Cron/Queue Workerに移動する。
- Publicリポジトリで60日活動がない場合、Scheduled workflowsが自動停止されることがある。
- runnerはジョブごとに原則使い捨て。Artifactは7日で失効する。**本番データをArtifactだけに保存してはいけない**。永続化はPostgreSQL/オブジェクトストレージへ。
- workflowの権限は`contents: read`。PRで外部提供されたコードに本番Secretを渡さない。依存Actionsは公開前にSHA固定を検討する。
- ログとArtifactにAPIキー、非公開のPro商品一覧、原データ、会員情報を出さない。
- リポジトリをPublicに切り替えるとコミット履歴も公開対象になる。後から削除しても完全消去は保証できない。秘密情報を先にコミットしない。

## 5. 移行時の権限・資格情報

実データ用adapterを開発する前に `docs/DATA_SOURCE_APPROVAL.md` に証拠、許諾範囲、期限、対象操作を登録する。例の `config/source-permissions.example.json` は全source deny。

必要になった場合のみ、GitHub Actions Secretsまたは外部Secret ManagerにLLM APIキー・データ提供契約APIキー・DB接続情報を保存する。OIDCをサポートするクラウドでは長期キーより短期認証を選ぶ。

`RUN_MODE=AUTHORIZED_API`のような環境変数だけで収集許可を与えてはいけない。権限レコードをサーバーが確認し、用途と期限に適合するadapterだけを実行する。

## 6. 本番化に必要な実装

1. 台帳をDBで管理し、収集・AI入力・保存・公開・画像表示を個別に認可。
2. 公式API/ライセンスFeedから取得し、出自・取得時刻・使用権利を保存。
3. AIが型番候補を返しても厳密一致・状態一致を再検証。
4. 相場統計・販売数の根拠がなければ`unavailable`として保留。
5. 利益計算（fees/FX/shipping/returns/taxes）を純粋関数として再実行可能にする。
6. 顧客向け公開はバックエンドの`publishable`判定、Pro認可、鮮度チェックを必ず通す。
7. LLM予算、APIクォータ、429/403での停止、失敗通知、冪等・再試行を実装。
8. Playwright/browser自動操作を使う場合も、相手先による自動アクセス許諾が前提。回避行為は行わない。
9. 永続DB・Webアプリ・サブスク導入後、E2Eと監視・バックアップを追加。

## 7. Private/Publicの運用判断

このリポジトリは2026-10-26時点でPrivate。仕入れ候補選定・スコアリングは事業上のノウハウになるため、**初期はPrivateを推奨**。2,000分/月を超えるほど定期ジョブが増えた場合、Public化ではなく、まずバッチ短縮・有償枠・クラウドCronとの費用比較を行う。

将来OSS化する場合は、一般化したAPIクライアント/コアロジックだけPublicへ切り出し、データ、秘密情報、Pro判定と会員情報はPrivate保持も選択肢。

## 8. 一次資料

- GitHub Actions課金：https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub Actions schedule：https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Workflow構文：https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- データ利用に関する公式ソース：`docs/DESIGN.md` の第19章。
