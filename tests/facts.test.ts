import assert from "node:assert/strict";
import { test } from "node:test";
import type { MergedSegment } from "../src/types.ts";
import { autoFactChecks, extractNumbers, extractUrls, hasNegation } from "../src/validate/facts.ts";

const seg = (original: string, easy: string): MergedSegment => ({ id: "s1", kind: "paragraph", original, easy });
const categories = (original: string, easy: string) => autoFactChecks([seg(original, easy)]).map((w) => w.category);

test("日付の数字が残っていれば警告しない（T1）", () => {
  assert.deepEqual(categories("11月30日までにお申し込みください。", "11月30日までに もうしこんでください。"), []);
});

test("数字が消えたり変わったりしたら警告する", () => {
  assert.deepEqual(categories("11月30日までにお申し込みください。", "はやく もうしこんでください。"), ["fact-check"]);
  assert.deepEqual(categories("参加費は500円です。", "さんかひは 50えんです。"), ["fact-check"]);
});

test("全角数字と桁区切りは同じ数として扱う（T10）", () => {
  assert.deepEqual(categories("料金は１，０００円です。", "おかねは 1000えんです。"), []);
  assert.deepEqual(extractNumbers("1,000円と2.5km"), ["1000", "2.5"]);
});

test("URLとメールアドレスが変わったら警告する", () => {
  assert.deepEqual(extractUrls("詳細は https://example.org/info。"), ["https://example.org/info"]);
  assert.deepEqual(
    categories("詳細は https://example.org/info をご覧ください。", "くわしくは https://example.org/ を みてください。"),
    ["url-contact"],
  );
  assert.deepEqual(categories("連絡先：info@example.org", "れんらくさき：info@example.org"), []);
  assert.deepEqual(categories("連絡先：info@example.org", "れんらくさき：メール"), ["url-contact"]);
});

test("URL の中の数字は数字の照合と二重に数えない", () => {
  assert.deepEqual(categories("https://example.org/2026 を見てください。", "みてください。"), ["url-contact"]);
});

test("否定が消えたら警告する（T6）", () => {
  assert.deepEqual(categories("提出しなくてもかまいません。", "かならず だしてください。"), ["negation"]);
  assert.deepEqual(categories("提出しなくてもかまいません。", "ださなくても いいです。"), []);
  assert.deepEqual(categories("申込は不要です。", "もうしこみは いりません。"), []);
});

test("否定表現の簡易判定", () => {
  assert.equal(hasNegation("参加できません"), true);
  assert.equal(hasNegation("かならず だしてください"), false); // 「ず」では判定しない
});
