import assert from "node:assert/strict";
import { test } from "node:test";
import { segmentPlainText } from "../src/parse/text.ts";
import { mergeResult } from "../src/validate/result.ts";
import { createWorkFile, parseWorkFile } from "../src/work.ts";

function makeWork(text = "一つ目です。\n\n二つ目です。") {
  return createWorkFile({ kind: "text", path: null, label: "直接入力した文章", segments: segmentPlainText(text) });
}
const roundTrip = <T>(v: T): unknown => JSON.parse(JSON.stringify(v));

test("作業ファイルは JSON を往復しても検証を通る", () => {
  const work = makeWork();
  assert.deepEqual(parseWorkFile(roundTrip(work)), work);
});

test("原文が改変された作業ファイルは拒否する", () => {
  const work = roundTrip(makeWork()) as { segments: { original: string }[] };
  work.segments[0]!.original = "改変された文です。";
  assert.throws(() => parseWorkFile(work), /prepare の後に変更されています/);
});

test("セグメントの削除・並べ替えも改変として拒否する", () => {
  const work = roundTrip(makeWork()) as { segments: unknown[] };
  work.segments.reverse();
  assert.throws(() => parseWorkFile(work), /変更されています/);
});

test("別ツールのファイルや未対応バージョンは拒否する", () => {
  assert.throws(() => parseWorkFile({ ...makeWork(), tool: "other" }), /yasashii-ja の作業ファイルではありません/);
  assert.throws(() => parseWorkFile({ ...makeWork(), schemaVersion: 99 }), /schemaVersion/);
  assert.throws(() => parseWorkFile([]), /オブジェクトではありません/);
});

test("すべてのIDに変換結果があれば、原文の順序で結合する", () => {
  const doc = mergeResult(makeWork(), {
    segments: [
      { id: "s2", easy: "ふたつめです。" },
      { id: "s1", easy: "ひとつめです。\r\n" },
    ],
  });
  assert.deepEqual(doc.segments.map((s) => [s.id, s.original, s.easy]), [
    ["s1", "一つ目です。", "ひとつめです。"],
    ["s2", "二つ目です。", "ふたつめです。"],
  ]);
});

test("変換結果の欠け・未知のID・重複・空文字はエラー", () => {
  const work = makeWork();
  assert.throws(() => mergeResult(work, { segments: [{ id: "s1", easy: "a" }] }), /未変換のID: s2/);
  assert.throws(
    () => mergeResult(work, { segments: [{ id: "s1", easy: "a" }, { id: "s2", easy: "b" }, { id: "s9", easy: "c" }] }),
    /作業ファイルにありません: s9/,
  );
  assert.throws(
    () => mergeResult(work, { segments: [{ id: "s1", easy: "a" }, { id: "s1", easy: "b" }, { id: "s2", easy: "c" }] }),
    /重複/,
  );
  assert.throws(() => mergeResult(work, { segments: [{ id: "s1", easy: "  " }, { id: "s2", easy: "b" }] }), /easy が空/);
  assert.throws(() => mergeResult(work, { segments: [{ id: "s1" }, { id: "s2", easy: "b" }] }), /easy が空/);
  assert.throws(() => mergeResult(work, {}), /segments 配列がありません/);
  assert.throws(() => mergeResult(work, null), /オブジェクトではありません/);
});

const okSegments = [{ id: "s1", easy: "ひとつめです。" }, { id: "s2", easy: "ふたつめです。" }];

test("警告の形式を検証する", () => {
  const work = makeWork();
  const doc = mergeResult(work, {
    segments: okSegments,
    warnings: [{ category: "ambiguous", segmentId: "s1", message: " 意味が二通りに読めます。 ", status: "needs-review" }],
  });
  assert.deepEqual(doc.warnings, [
    { category: "ambiguous", segmentId: "s1", message: "意味が二通りに読めます。", status: "needs-review", origin: "llm" },
  ]);

  const bad = (w: object) => () => mergeResult(work, { segments: okSegments, warnings: [w] });
  const base = { category: "other", segmentId: null, message: "x", status: "needs-review" };
  assert.throws(bad({ ...base, category: "nope" }), /category が不正/);
  assert.throws(bad({ ...base, status: "passed" }), /status が不正/); // 「合格」は表せない
  assert.throws(bad({ ...base, segmentId: "s9" }), /存在しないセグメント/);
  assert.throws(bad({ ...base, message: "" }), /message が空/);
});

test("__proto__ を含む変換結果でもプロトタイプを汚染しない", () => {
  const result = JSON.parse('{"__proto__":{"polluted":true},"segments":[{"id":"s1","easy":"a"},{"id":"s2","easy":"b"}]}');
  mergeResult(makeWork(), result);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
