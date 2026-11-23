# yasashii-ja

**むずかしい日本語を、伝わる日本語に。文章も、Webサイトも。**

`yasashii-ja` は、日本語に不慣れな人にも伝わりやすい「やさしい日本語」への変換を支援する、Claude Code 向け Agent Skill の開発プロジェクトです。

> **Status: MVP 開発中（v0.1.0 / M1）**  
> 現在動くのは **直接渡した文章 → HTMLプレビュー** だけです。Markdown・HTML・i18n JSON の入力は未実装です（下の「想定する使い方」は今後の予定を含みます）。

## いま使えること（M1）

必要なもの：Node.js 24 以上（`.ts` をそのまま実行します。ビルドは不要です）。

- **推奨：Node.js 26 LTS の最新版**（2026-11-23 時点で 26.13.1）。v24 を使う場合は 24.22.3 以上。
- 上の版は 2026-11-11 のセキュリティリリースで修正されたものです。Node.js は定期的にセキュリティ修正を出すので、各系列の最新パッチ版を使ってください（[Node.js のセキュリティ情報](https://nodejs.org/en/blog/vulnerability)）。
- 開発用の版は `.node-version` に書いてあります（nvm・fnm などで利用できます）。

### Claude Code から使う

このリポジトリを Claude Code で開くと、プロジェクトスキル `.claude/skills/yasashii-ja/` が使えます。

```text
/yasashii-ja "参加をご希望の方は、11月30日までにお申し込みください。"
```

現在のフォルダに `yasashii-preview.html` ができます（同名のファイルがあれば `yasashii-preview-2.html` などの別名で保存し、上書きしません）。ブラウザで開くと、ボタンで「やさしい日本語」と「元の日本語」を切り替えられます。確認が必要な点は、ページ下の「確認が必要なこと」に表示されます。

### しくみ

書き換えの判断は Claude が行い、それ以外は CLI が決定論的に行います。

1. `node src/cli.ts prepare --text-file input.txt` … 文章を段落・箇条書きに分け、原文をハッシュ付きで固定した作業ファイルを作る
2. Claude が書き換え結果と注意点を `result.json` に書く（[形式](.claude/skills/yasashii-ja/references/work-format.md)・[書き換え方針](.claude/skills/yasashii-ja/references/rewrite-policy.md)）
3. `node src/cli.ts render --work work.json --result result.json` … 全段落がそろっているか検証し、数字・URL・メールアドレス・否定表現が消えていないかを自動照合して、外部通信なしの単体HTMLを作る

生成例：[examples/direct-text/](examples/direct-text/)（`input.txt` → `yasashii-preview.html`）

### 開発

```sh
npm install      # 型検査用の devDependencies のみ
npm test         # node:test によるテスト
npm run check    # 型検査 + テスト
```

### 既知の制限（M1）

- 入力は直接渡した文章のみ。上限は 1 MiB・500 段落。UTF-8 のみ。
- 自動照合は「原文の数字・URL等が変換後に見当たらない」ことを知らせるだけで、意味の一致は保証しません。漢数字・和暦・曜日は照合しません。否定表現の検出は簡易的です。
- スキルの配布・インストール方法（他のリポジトリで使う方法）は未整備です。

## 何をつくるか

MVP は **2 つの出力**に限定します。

1. **HTML プレビュー**：文章の直接入力、Markdown、HTMLから日本語の文章を取り出して書き換え、元の文章と「やさしい日本語」を切り替えて比較できる単体HTMLファイルを生成。
2. **i18n 用 JSON**：既存の日本語言語ファイルから、キー・階層・補間変数を維持した「やさしい日本語」版JSONファイルを生成。

どちらも **原文の情報を勝手に変えないこと**と、重要な意味のずれを **人が確認できること**を重視します。

## 想定する使い方（実装予定）

Claude Code で、このスキルを使える環境にした後：

```text
/yasashii-ja "申請を希望される方は、必要事項をご記入ください。"
/yasashii-ja ./docs/notice.md
/yasashii-ja ./public/notice.html
/yasashii-ja ./locales/ja.json
```

- 文章、`.md`、`.html` → `*.easy.html`（元の日本語とやさしい日本語を切り替えるオフラインプレビュー）
- `.json` → `ja-easy.json` などの別ファイル（元ファイルは変更しない）

入力に不確かな意味があれば、変換結果に注意・要確認として示します。

## 想定ユーザー

- 日本語を母語としない人へお知らせを届けたい自治体・学校・NPO・地域団体・個人
- 日本語のWebサイトに「やさしい日本語」を追加したい開発者
- i18n を詳しく知らなくても、既存の JSON 言語ファイルから成果物を得たいAIコーディング初心者

## MVP で扱わないこと

- Webサイトへのi18n機構の導入、ルーティング・言語切り替えUIの自動組み込み
- PDF、Word、CMS、データベース、Web URLの直接収集
- 元ファイルの自動上書き・公開・デプロイ
- 内容の事実確認や法的正確性の保証
- JLPT 等級や「理解できる人の割合」の断定

## 文書を読む順番

1. [初期コンセプト](docs/01-CONCEPT.md)
2. [MVP要件・利用シナリオ](docs/02-MVP-REQUIREMENTS.md)
3. [技術設計・入出力](docs/03-DESIGN.md)
4. [品質・安全性とテスト](docs/04-QUALITY-AND-TESTS.md)
5. [実装計画](docs/05-IMPLEMENTATION-PLAN.md)
6. [参考資料・既存OSSとの関係](docs/06-REFERENCES.md)
7. [Claude Code 引き継ぎメモ](docs/07-HANDOFF.md)
8. [技術判断の記録](docs/08-DECISIONS.md)

Claude Code に作業を任せる場合は、まず [CLAUDE.md](CLAUDE.md) と [引き継ぎメモ](docs/07-HANDOFF.md) を読ませてください。

## 規範・立場

出入国在留管理庁・文化庁「在留支援のためのやさしい日本語ガイドライン」を**参考基準**とします。国・自治体・Anthropic による公式製品ではありません。成果物は利用者が最終確認する必要があります。

- 公式ガイドライン：https://www.moj.go.jp/isa/support/portal/plainjapanese_guideline.html
- Agent Skills 仕様：https://agentskills.io/specification
- Claude Code Skills：https://code.claude.com/docs/en/skills

## ライセンス

未決定（候補：MIT）。他者のコード、辞書、書き換え例を導入する場合は各ライセンスを事前に確認します。
