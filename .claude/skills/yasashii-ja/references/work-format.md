# 作業ファイルと変換結果の形式

## work.json（CLI が作る・変更しない）

```json
{
  "schemaVersion": 1,
  "tool": "yasashii-ja",
  "source": { "kind": "text", "path": null, "label": "直接入力した文章" },
  "segments": [
    { "id": "s1", "kind": "paragraph", "original": "申請を希望される方は、必要事項をご記入ください。" }
  ],
  "integrity": "sha256-…",
  "warnings": []
}
```

- `kind`：`paragraph`（段落）/ `list-item`（箇条書きの1項目）/ `heading`（見出し）
- `integrity` は原文のハッシュ。work.json の `segments` を変更すると render が拒否する。

## result.json（Claude が書く）

```json
{
  "segments": [
    { "id": "s1", "easy": "しんせいしたい人は、ひつような ことを 書いてください。" }
  ],
  "warnings": [
    {
      "category": "terminology",
      "segmentId": "s1",
      "message": "「必要事項」が何を指すか原文に書かれていません。書く項目を示すと、より分かりやすくなります。",
      "status": "needs-review"
    }
  ]
}
```

### segments（必須）

- work.json のすべての `id` に、空でない `easy` を1つずつ。順番は自由（表示は原文の順）。
- どうしても書き換えられない文は、原文をそのまま `easy` に入れ、理由を `warnings` に `status: "unverified"` で書く。

### warnings（任意・配列）

| フィールド | 値 |
|---|---|
| `category` | 下の一覧のどれか |
| `segmentId` | 対象の `id`。文章全体のことなら `null` |
| `message` | 何が・なぜ心配かを具体的に（2000字まで） |
| `status` | `needs-review`（人の確認が必要）/ `unverified`（確認できなかった） |

「問題なし」「合格」を表す状態はない。心配がなければ警告を書かない。

| category | 使う場面 |
|---|---|
| `date-time` | 日付・時刻・期間・締切 |
| `amount` | 金額・料金・税込/税別 |
| `quantity` | 人数・回数などの数量 |
| `target` | 対象者・資格 |
| `condition` | 条件（〜の場合） |
| `exception` | 例外・ただし書き |
| `negation` | 否定・禁止 |
| `modality` | 義務／任意／可能性（必ず・できる・ことがある） |
| `proper-noun` | 制度名・施設名などの固有名詞・正式名称 |
| `url-contact` | URL・電話・メール・住所・窓口 |
| `terminology` | 専門用語の言い換え・説明の追加 |
| `sensitive-domain` | 法律・医療・防災・お金など、専門家の確認が必要な内容 |
| `ambiguous` | 原文自体があいまいで、書き換えで解釈を選んだ |
| `unsupported` | 書き換えなかった部分 |
| `fact-check` | （主に CLI の自動照合が使う） |
| `other` | その他 |
