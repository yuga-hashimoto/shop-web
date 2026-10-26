# Architecture Decision Records

## ADR-001: Private first / 2026-10-26
**Decision:** リポジトリはPrivateを維持。Public化は行わない。

**Reason:** GitHub FreeではPrivateのActions無料枠2,000分/月があり、MVPの6時間ごとの軽量ジョブ＋CIなら枠内で検証可能。事業ロジック・商品候補選定・収益機会・Pro向け基盤を公開する価値は現時点で少ない。将来的なPublic化は費用とOSS戦略を再評価する。

**Consequences:** GitHub Actionsの実行時間を監視する。枠超過が見込まれたら外部Cronやプラン変更と比較する。

## ADR-002: MOCK-only scheduled run / 2026-10-26
**Decision:** CI・6時間ごとの定期ジョブを導入するが、外部データ取得は行わない。

**Reason:** eBay成約データ、メルカリ個別出品の商用収集/AI入力/派生価格再表示について利用許諾が未確認。AIブラウザ操作による技術的取得は許諾を代替しない。

**Consequences:** `npm run pipeline:mock`は架空の計算レポートをArtifactに出すのみ。Publish不可。承認データのadapter導入後に段階移行する。

## ADR-003: Mercari Ambassador disabled / 2026-10-26
**Decision:** 転売利益を訴求する本サイトではメルカリアンバサダー機能をOFF固定。

**Reason:** 公式ガイドラインがアフィリエイトリンク経由の転売促進・助長を禁止している。検索結果リンクも例外ではない。

**Consequences:** 初期財務モデルは広告＋Pro。通常の検索クエリ/リンクを採用。規約適合する別用途が生じた場合のみ明示的承認のもと再判断。
