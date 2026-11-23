import assert from "node:assert/strict";
import { test } from "node:test";
import { fileKindFromPath, looksLikePath } from "../src/input/classify.ts";

test("ファイルの場所らしい文字列を見分ける", () => {
  for (const s of ["./docs/notice.md", "notice.html", "locales/ja.json", "~/a.txt", "/tmp/x", "C:\\a\\b.htm", " notice.md\n"]) {
    assert.equal(looksLikePath(s), true, s);
  }
});

test("文章はファイルの場所とみなさない", () => {
  for (const s of ["申請を希望される方は、必要事項をご記入ください。", "詳細は example.md を見てください。", "", "11月30日"]) {
    assert.equal(looksLikePath(s), false, s);
  }
});

test("拡張子から入力の種類を決める", () => {
  assert.equal(fileKindFromPath("a.MD"), "markdown");
  assert.equal(fileKindFromPath("a.htm"), "html");
  assert.equal(fileKindFromPath("ja.json"), "json");
  assert.equal(fileKindFromPath("a.pdf"), "unknown");
});
