# 06. 一次資料・先行OSS

最終確認日：2026-11-23（設計資料作成時）。外部サイトの仕様は更新され得る。

## やさしい日本語の一次資料

### 出入国在留管理庁・文化庁

- [在留支援のためのやさしい日本語ガイドライン（公式案内ページ）](https://www.moj.go.jp/isa/support/portal/plainjapanese_guideline.html)
- 上記ページ内の「在留支援のためのやさしい日本語ガイドライン（PDF）」「別冊 やさしい日本語書き換え例」を、文体ルールとテスト観点の参考にする。
- 公式ページの利用条件を確認し、第三者のコードや文章の大量転載・辞書の無断再配布はしない。
- 本プロジェクトは政府の認定・監修・公式提供を受けるものではない。「準拠」や「保証」という語は検証範囲を明示せずに使わない。

## Agent Skillsの仕様

- [Agent Skills Specification](https://agentskills.io/specification)
- [Claude Code: Extend Claude with skills](https://code.claude.com/docs/en/skills)

設計ポイント：`SKILL.md`（YAML frontmatterと本文）、追加の `references/`・`scripts/`、Claude Codeのプロジェクトスキル配置 `.claude/skills/<skill-name>/SKILL.md`、`$ARGUMENTS` による引数の受け渡し。インストール・配布形態は実装後に検証する。

## 既存OSS

- [bamboo-nova/meiseki](https://github.com/bamboo-nova/meiseki) 内の `yorisoi`：やさしい日本語への書き換え、規範に基づく検査、語彙レベルの推定。

**差別化は「全く同じ変換を実装し直すこと」ではない。** 本プロジェクトは、(a) 直接入力・Markdown・HTMLの取り込み、(b) 切替式のオフラインHTML生成、(c) i18n JSONの不変条件検証と別ファイル生成、をMVP中心に置く。

`yorisoi` の文章変換品質を比較ベンチマークとして扱うことは有用。ただし、そのコードや辞書等を再利用する場合、リポジトリのライセンスと依存データの利用条件を先に確認する。

## セキュリティとアクセシビリティの技術参考

- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [W3C WAI: Accessibility Fundamentals](https://www.w3.org/WAI/fundamentals/)
- HTML生成時の不正なスクリプト実行、ユーザー入力のHTML埋め込み、切替UIのキーボード操作などを実装時に確認する。

## リファレンスの扱い

文書にリンクとして記載することと、内容やデータを複製して配布することは別。引用・利用規約・ライセンスを確認して取り込むこと。
