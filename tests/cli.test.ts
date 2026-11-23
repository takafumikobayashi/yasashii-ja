import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { MAX_INPUT_BYTES } from "../src/limits.ts";
import { withTempDir } from "./helpers.ts";

const CLI = resolve(import.meta.dirname, "../src/cli.ts");

function run(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json: () => JSON.parse(r.stdout) };
}

function prepareText(dir: string, text: string, ...extra: string[]) {
  writeFileSync(join(dir, "input.txt"), text);
  return run(dir, "prepare", "--text-file", "input.txt", "--work", "work.json", ...extra);
}

const T1 = "参加をご希望の方は、11月30日までにお申し込みください。";

test("直接テキストから切替HTMLを生成する（T1・受け入れ条件1）", () =>
  withTempDir((dir) => {
    const p = prepareText(dir, T1);
    assert.equal(p.code, 0, p.stderr);
    const prepared = p.json();
    assert.equal(prepared.workFile, join(dir, "work.json"));
    assert.deepEqual(prepared.segments, [{ id: "s1", kind: "paragraph", original: T1 }]);

    writeFileSync(join(dir, "result.json"), JSON.stringify({ segments: [{ id: "s1", easy: "さんかしたい人は、11月30日までに もうしこんでください。" }] }));
    const r = run(dir, "render", "--work", "work.json", "--result", "result.json");
    assert.equal(r.code, 0, r.stderr);
    const rendered = r.json();
    assert.equal(rendered.output, join(dir, "yasashii-preview.html"));
    assert.equal(rendered.warningCount, 0);

    const html = readFileSync(rendered.output, "utf8");
    assert.ok(html.includes(T1));
    assert.ok(html.includes("11月30日までに もうしこんでください。"));
    assert.ok(html.includes('data-mode-button="original"'));
    // 入力ファイルは変更されない
    assert.equal(readFileSync(join(dir, "input.txt"), "utf8"), T1);
  }));

test("2回目の生成は既存のHTMLを上書きしない（T7）", () =>
  withTempDir((dir) => {
    prepareText(dir, T1);
    writeFileSync(join(dir, "result.json"), JSON.stringify({ segments: [{ id: "s1", easy: "11月30日まで" }] }));
    writeFileSync(join(dir, "yasashii-preview.html"), "OLD");
    const r = run(dir, "render", "--work", "work.json", "--result", "result.json");
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json().output, join(dir, "yasashii-preview-2.html"));
    assert.equal(r.json().renamed, true);
    assert.equal(readFileSync(join(dir, "yasashii-preview.html"), "utf8"), "OLD");
  }));

test("意味の反転・数字の欠落は警告として報告される（T6）", () =>
  withTempDir((dir) => {
    prepareText(dir, "提出しなくてもかまいません。\n\n11月30日までです。");
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({ segments: [{ id: "s1", easy: "かならず だしてください。" }, { id: "s2", easy: "もうすぐです。" }] }),
    );
    const r = run(dir, "render", "--work", "work.json", "--result", "result.json");
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json().warnings.map((w: { category: string; segmentId: string }) => [w.category, w.segmentId]), [
      ["negation", "s1"],
      ["fact-check", "s2"],
    ]);
  }));

test("変換結果が不完全なら HTML を作らない", () =>
  withTempDir((dir) => {
    prepareText(dir, "一つ目。\n\n二つ目。");
    writeFileSync(join(dir, "result.json"), JSON.stringify({ segments: [{ id: "s1", easy: "ひとつめ。" }] }));
    const r = run(dir, "render", "--work", "work.json", "--result", "result.json");
    assert.equal(r.code, 1);
    assert.match(r.stderr, /未変換のID: s2/);
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith(".html")), []);
  }));

test("作業ファイルの原文を書き換えると拒否する", () =>
  withTempDir((dir) => {
    prepareText(dir, T1);
    const work = JSON.parse(readFileSync(join(dir, "work.json"), "utf8"));
    work.segments[0].original = "締切はありません。";
    writeFileSync(join(dir, "work.json"), JSON.stringify(work));
    writeFileSync(join(dir, "result.json"), JSON.stringify({ segments: [{ id: "s1", easy: "x" }] }));
    const r = run(dir, "render", "--work", "work.json", "--result", "result.json");
    assert.equal(r.code, 1);
    assert.match(r.stderr, /変更されています/);
  }));

test("ファイルの場所らしい文字列は、確認なしに文章として変換しない", () =>
  withTempDir((dir) => {
    const r = prepareText(dir, "./docs/notice.md");
    assert.equal(r.code, 2);
    assert.match(r.stderr, /ファイルの場所のように見えます/);
    const ok = prepareText(dir, "./docs/notice.md", "--confirm-text");
    assert.equal(ok.code, 0, ok.stderr);
  }));

test("対象外・失敗の入力をはっきり伝える（T8）", () =>
  withTempDir((dir) => {
    const cases: [string[], RegExp][] = [
      [["prepare", "missing.md"], /ファイルが見つかりません/],
      [["prepare", "--text-file", "missing.txt"], /ファイルが見つかりません/],
      [["prepare"], /入力を1つだけ指定/],
      [["render", "--work", "w.json"], /--work と --result/],
      [["unknown"], /不明なコマンド/],
    ];
    writeFileSync(join(dir, "notice.md"), "# 見出し");
    writeFileSync(join(dir, "ja.json"), "{}");
    writeFileSync(join(dir, "a.pdf"), "x");
    cases.push([["prepare", "notice.md"], /M2 で対応予定/]);
    cases.push([["prepare", "ja.json"], /M3 で対応予定/]);
    cases.push([["prepare", "a.pdf"], /対応していない種類/]);

    writeFileSync(join(dir, "bad-utf8.txt"), Buffer.from([0xe3, 0x81, 0x28]));
    cases.push([["prepare", "--text-file", "bad-utf8.txt"], /UTF-8 として読み込めません/]);
    writeFileSync(join(dir, "big.txt"), "あ".repeat(MAX_INPUT_BYTES / 3 + 1));
    cases.push([["prepare", "--text-file", "big.txt"], /大きすぎます/]);
    writeFileSync(join(dir, "empty.txt"), "\n\n");
    cases.push([["prepare", "--text-file", "empty.txt"], /空の入力/]);
    writeFileSync(join(dir, "broken.json"), "{");
    cases.push([["render", "--work", "broken.json", "--result", "broken.json"], /正しい JSON ではありません/]);

    for (const [args, pattern] of cases) {
      const r = run(dir, ...args);
      assert.equal(r.code, 1, args.join(" "));
      assert.match(r.stderr, pattern, args.join(" "));
    }
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith(".html")), []);
  }));

test("出力先を .html 以外にはしない", () =>
  withTempDir((dir) => {
    prepareText(dir, T1);
    writeFileSync(join(dir, "result.json"), JSON.stringify({ segments: [{ id: "s1", easy: "x" }] }));
    const r = run(dir, "render", "--work", "work.json", "--result", "result.json", "--out", "input.txt");
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\.html で終わる/);
    assert.equal(readFileSync(join(dir, "input.txt"), "utf8"), T1);
  }));

test("BOM 付き UTF-8 を読める", () =>
  withTempDir((dir) => {
    const r = prepareText(dir, "﻿" + T1);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json().segments[0].original, T1);
  }));
