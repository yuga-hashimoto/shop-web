# データソースの承認チェックリスト

**初期状態：すべて未承認。未承認の実データは収集・公開しない。**

## 1. ソースごとに別々の権利を確認する

| ソース | 自動取得 | AI入力 | 保存/集計 | Webで第三者提供 | ステータス |
|---|---|---|---|---|---|
| メルカリ個人出品 | 未確認 | 未確認 | 未確認 | 未確認 | DISABLED |
| eBayの現在出品 | 本番APIアクセス要確認 | 利用条件要確認 | 利用条件要確認 | 利用条件要確認 | DISABLED |
| eBay成約データ | 利用承認が必要 | 利用条件要確認 | 利用条件要確認 | 利用条件要確認 | DISABLED |
| メルカリアンバサダー | 転売促進用途は禁止 | 対象外 | 対象外 | 対象外 | OFF |

検索クエリへの**通常リンク**は、許可される範囲で個別出品データ再掲載の代替として扱う。アフィリエイト付き検索リンクなら転売促進禁止の問題は解決しない。

## 2. SourcePermissionの登録必須フィールド

- `source`, `accountId`, `contractOwner`
- `status: APPROVED | PENDING | REVOKED | EXPIRED`
- `permissionEvidenceUrl`, `termsVersion`, `signedAt`, `expiresAt`
- `allowedOperations`: collect / model_input / save / aggregate / redistribute / image_display
- `licenseScope`, `marketplace`, `retentionDays`, `rateBudget`
- 署名付き契約など機微文書はSecret ManagerやPrivateストレージに配置し、パブリックなログ・Artifactへ保存しない。

承認には明示的な証拠が必要。SourcePermissionの`APPROVED`をAIが推測・自動設定してはいけない。

## 3. テスト条件

1. 未承認、失効、用途外、超過したAPIクォータ → 収集不可。
2. 権利のないデータはAIへ投入しない。取得許諾とAI入力許諾は別。
3. 取得や保存の許可があっても、派生相場の第三者再提供は別途確認。
4. 403/429/CAPTCHA/サイト禁止通知 → 回避せず停止・通知。
5. 禁止商品カテゴリ、情報鮮度期限切れ、証拠欠落 → 公開不可。
6. 許諾取消し後は公開キャッシュも削除・通知を停止。
