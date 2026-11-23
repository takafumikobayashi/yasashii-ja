import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { writeNewFile } from "../src/output/write.ts";
import { withTempDir } from "./helpers.ts";

test("新しいファイルとして保存する", () =>
  withTempDir((dir) => {
    const r = writeNewFile(join(dir, "out.html"), "A");
    assert.deepEqual(r, { path: join(dir, "out.html"), renamed: false });
    assert.equal(readFileSync(r.path, "utf8"), "A");
  }));

test("既存ファイルは上書きせず、別名で保存する（T7）", () =>
  withTempDir((dir) => {
    const p = join(dir, "yasashii-preview.html");
    writeFileSync(p, "OLD");
    const r1 = writeNewFile(p, "NEW1");
    const r2 = writeNewFile(p, "NEW2");
    assert.equal(readFileSync(p, "utf8"), "OLD");
    assert.equal(r1.path, join(dir, "yasashii-preview-2.html"));
    assert.equal(r2.path, join(dir, "yasashii-preview-3.html"));
    assert.equal(r1.renamed, true);
    assert.equal(readFileSync(r2.path, "utf8"), "NEW2");
  }));

test("一時ファイルを残さない", () =>
  withTempDir((dir) => {
    writeNewFile(join(dir, "a.html"), "A");
    writeNewFile(join(dir, "a.html"), "B");
    assert.deepEqual(readdirSync(dir).sort(), ["a-2.html", "a.html"]);
  }));

test("force のときだけ上書きする", () =>
  withTempDir((dir) => {
    const p = join(dir, "a.html");
    writeFileSync(p, "OLD");
    assert.deepEqual(writeNewFile(p, "NEW", { force: true }), { path: p, renamed: false });
    assert.equal(readFileSync(p, "utf8"), "NEW");
  }));

test("入力ファイルは force でも上書きしない", () =>
  withTempDir((dir) => {
    const input = join(dir, "notice.html");
    writeFileSync(input, "ORIGINAL");
    assert.throws(() => writeNewFile(input, "X", { force: true, protectedPaths: [input] }), /入力ファイルと同じ場所/);
    const r = writeNewFile(input, "X", { protectedPaths: [input] });
    assert.equal(r.path, join(dir, "notice-2.html"));
    assert.equal(readFileSync(input, "utf8"), "ORIGINAL");
    assert.deepEqual(readdirSync(dir).sort(), ["notice-2.html", "notice.html"]);
  }));

test("保存先のフォルダがなければエラーにし、何も作らない", () =>
  withTempDir((dir) => {
    assert.throws(() => writeNewFile(join(dir, "nope", "a.html"), "A"), /保存先のフォルダがありません/);
    assert.equal(existsSync(join(dir, "nope")), false);
  }));
