import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { escapeHtml } from "../src/render/escape.ts";
import { renderPreviewHtml, SCRIPT, STYLE } from "../src/render/html.ts";
import type { MergedSegment, PreviewDocument, Warning } from "../src/types.ts";

const NOW = new Date(2026, 10, 23, 9, 5);

function doc(segments: Partial<MergedSegment>[], warnings: Warning[] = []): PreviewDocument {
  return {
    source: { kind: "text", path: null, label: "直接入力した文章" },
    segments: segments.map((s, i) => ({ id: `s${i + 1}`, kind: "paragraph", original: "原文", easy: "やさしい", ...s })),
    warnings,
  };
}

const ATTACKS = [
  "<script>alert('x')</script>",
  "</script><script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  '"><svg onload=alert(1)>',
  "<a href=\"javascript:alert(1)\">リンク</a>",
  "<iframe src=https://evil.example></iframe>",
  "<!-- --><style>body{display:none}</style>",
  "&lt;script&gt;",
];

test("escapeHtml は5文字をエスケープする", () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("基本構造：lang=ja・UTF-8・切替ボタン・注意書き（T1）", () => {
  const html = renderPreviewHtml(doc([{ original: "11月30日までにお申し込みください。", easy: "11月30日までに もうしこんでください。" }]), { generatedAt: NOW });
  assert.match(html, /^<!doctype html>\n<html lang="ja"/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<button type="button" data-mode-button="easy" aria-pressed="true">やさしい日本語<\/button>/);
  assert.match(html, /<button type="button" data-mode-button="original" aria-pressed="false">元の日本語<\/button>/);
  assert.ok(html.includes("11月30日までにお申し込みください。"));
  assert.ok(html.includes("11月30日までに もうしこんでください。"));
  assert.ok(html.includes("公開する前に、人が内容を確認してください。"));
  assert.ok(html.includes("2026-11-23 09:05"));
});

test("原文・変換後・警告に含まれるHTMLは実行可能な形で出力されない（T3）", () => {
  const segments = ATTACKS.map((a) => ({ original: a, easy: a }));
  const warnings: Warning[] = ATTACKS.map((a) => ({ category: "other", segmentId: "s1", message: a, status: "needs-review", origin: "llm" }));
  const d = doc(segments, warnings);
  d.source.label = ATTACKS[0]!;
  const html = renderPreviewHtml(d, { generatedAt: NOW });

  assert.equal(html.match(/<script/gi)?.length, 1, "スクリプトはツール自身の1つだけ");
  assert.equal(html.match(/<style/gi)?.length, 1, "スタイルはツール自身の1つだけ");
  for (const tag of ["<img", "<svg", "<iframe", "<a href=\"javascript"]) {
    assert.equal(html.toLowerCase().includes(tag), false, tag);
  }
  // 実際のタグ（エスケープされていない "<" で始まるもの）にイベントハンドラ属性がない
  for (const tagText of html.match(/<[a-z][^>]*>/gi) ?? []) {
    assert.doesNotMatch(tagText, /\son\w+\s*=/i, tagText);
  }
  for (const a of ATTACKS) assert.ok(html.includes(escapeHtml(a)), `エスケープされて表示される: ${a}`);
  // スクリプト要素の中身はツール自身のものと完全一致
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.equal(inline, SCRIPT);
});

test("リンクはページ内のアンカーだけで、外部の資源を読み込まない（A-05）", () => {
  const html = renderPreviewHtml(
    doc([{ original: "詳細は https://example.org/info をご覧ください。" }], [
      { category: "url-contact", segmentId: "s1", message: "https://example.org/info", status: "needs-review", origin: "auto" },
    ]),
    { generatedAt: NOW },
  );
  for (const m of html.matchAll(/\s(href|src|action)="([^"]*)"/g)) {
    assert.equal(m[1], "href");
    assert.ok(m[2]!.startsWith("#"), `外部リンク: ${m[2]}`);
  }
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /@import|url\(/i);
});

test("CSP でインラインのスクリプトとスタイルをハッシュ固定する", () => {
  const html = renderPreviewHtml(doc([{}]), { generatedAt: NOW });
  const hash = (s: string) => "sha256-" + createHash("sha256").update(s, "utf8").digest("base64");
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp);
  assert.ok(csp.includes("default-src &#39;none&#39;"));
  assert.ok(csp.includes(`script-src &#39;${hash(SCRIPT)}&#39;`));
  assert.ok(csp.includes(`style-src &#39;${hash(STYLE)}&#39;`));
  assert.ok(html.includes(`<style>${STYLE}</style>`));
});

test("箇条書きは ul にまとめ、順序を保つ", () => {
  const html = renderPreviewHtml(
    doc([
      { kind: "paragraph", original: "持ち物" },
      { kind: "list-item", original: "上履き" },
      { kind: "list-item", original: "水筒" },
      { kind: "paragraph", original: "以上です" },
    ]),
    { generatedAt: NOW },
  );
  const order = ["持ち物", "<ul", "上履き", "水筒", "</ul>", "以上です"].map((s) => html.indexOf(s));
  assert.ok(order.every((v) => v >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("警告がある段落に印をつけ、確認一覧に該当する原文を示す（A-08）", () => {
  const html = renderPreviewHtml(
    doc([{ original: "提出しなくてもかまいません。", easy: "かならず だしてください。" }], [
      { category: "negation", segmentId: "s1", message: "否定が消えています", status: "needs-review", origin: "auto" },
      { category: "sensitive-domain", segmentId: null, message: "医療の文章です", status: "unverified", origin: "llm" },
    ]),
    { generatedAt: NOW },
  );
  assert.match(html, /class="seg seg-paragraph has-warning" id="seg-s1"/);
  assert.match(html, /<a class="badge" href="#warn-s1">要確認<\/a>/);
  assert.match(html, /<li class="warning" id="warn-s1">/);
  assert.ok(html.includes("否定</span>"));
  assert.ok(html.includes("自動チェック"));
  assert.ok(html.includes("自動では確認できていない"));
  assert.ok(html.includes("該当する文</a>：「提出しなくてもかまいません。」"));
  assert.ok(html.includes("文章全体"));
});

test("警告がなくても「合格」とは表示しない", () => {
  const html = renderPreviewHtml(doc([{}]), { generatedAt: NOW });
  assert.ok(html.includes("意味が同じかどうかは人が確認してください"));
  assert.doesNotMatch(html, /合格|問題ありません|保証します/);
});
