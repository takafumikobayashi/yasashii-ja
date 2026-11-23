import { createHash } from "node:crypto";
import type { MergedSegment, PreviewDocument, Warning } from "../types.ts";
import { escapeHtml } from "./escape.ts";

/**
 * 単体で動く静的プレビューHTMLを生成する。
 * - 文字列はすべて escapeHtml を通して埋め込む。ユーザー由来のHTMLは一切そのまま入れない。
 * - 外部のJS/CSS/フォント/画像を読み込まない。CSP でインラインのスクリプトとスタイルをハッシュで固定し、
 *   それ以外（注入されたスクリプト、外部通信）をブラウザに拒否させる。
 * - JS が無効でも、原文とやさしい日本語の両方が読める。
 */
export function renderPreviewHtml(doc: PreviewDocument, options: { generatedAt: Date }): string {
  const warnedIds = new Set(doc.warnings.map((w) => w.segmentId).filter((id): id is string => id !== null));
  const segmentsById = new Map(doc.segments.map((s) => [s.id, s]));
  const csp = [
    "default-src 'none'",
    `script-src '${sha256(SCRIPT)}'`,
    `style-src '${sha256(STYLE)}'`,
    "img-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return `<!doctype html>
<html lang="ja" class="no-js" data-mode="easy">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex, nofollow">
<meta name="generator" content="yasashii-ja">
<title>やさしい日本語プレビュー（${escapeHtml(doc.source.label)}）</title>
<style>${STYLE}</style>
</head>
<body>
<header class="page-header">
  <h1>やさしい日本語プレビュー</h1>
  <p class="meta">元の文章：${escapeHtml(doc.source.label)}　／　段落 ${doc.segments.length} 件　／　確認が必要なこと ${doc.warnings.length} 件</p>
  <p class="notice" role="note"><strong>公開する前に、人が内容を確認してください。</strong>この文章はAIが書き換えたもので、意味が同じであることや、読む人が理解できることを保証しません。</p>
</header>
<div class="toolbar" role="group" aria-label="表示する文章">
  <span class="toolbar-label" aria-hidden="true">表示：</span>
  <button type="button" data-mode-button="easy" aria-pressed="true">やさしい日本語</button>
  <button type="button" data-mode-button="original" aria-pressed="false">元の日本語</button>
</div>
<main id="content">
${renderSegments(doc.segments, warnedIds)}
</main>
<section class="review" aria-labelledby="review-heading">
  <h2 id="review-heading">確認が必要なこと</h2>
${renderWarnings(doc.warnings, segmentsById)}
</section>
<section class="about" aria-labelledby="about-heading">
  <h2 id="about-heading">このプレビューについて</h2>
  <ul>
    <li>文章を確かめるためのページです。元のページのデザインや動きは再現しません。</li>
    <li>出入国在留管理庁・文化庁「在留支援のためのやさしい日本語ガイドライン」を参考にしています。公式の認定や監修を受けたものではありません。</li>
    <li>法律・医療・防災・お金に関わる文章は、とくに専門の人に確認してください。</li>
    <li>「確認が必要なこと」に何も出ていなくても、意味が同じとは限りません。</li>
  </ul>
</section>
<footer class="page-footer">
  <p>yasashii-ja で作成：${escapeHtml(formatDate(options.generatedAt))}</p>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

function renderSegments(segments: readonly MergedSegment[], warnedIds: ReadonlySet<string>): string {
  const out: string[] = [];
  let inList = false;
  for (const seg of segments) {
    if (seg.kind === "list-item" && !inList) {
      out.push("<ul class=\"seg-list\">");
      inList = true;
    } else if (seg.kind !== "list-item" && inList) {
      out.push("</ul>");
      inList = false;
    }
    const tag = seg.kind === "heading" ? "h2" : seg.kind === "list-item" ? "li" : "div";
    const cls = `seg seg-${seg.kind}${warnedIds.has(seg.id) ? " has-warning" : ""}`;
    const badge = warnedIds.has(seg.id)
      ? ` <a class="badge" href="#warn-${escapeHtml(seg.id)}">要確認</a>`
      : "";
    out.push(
      `<${tag} class="${cls}" id="seg-${escapeHtml(seg.id)}">` +
        `<span class="v v-easy"><span class="v-label">やさしい日本語：</span><span class="text">${escapeHtml(seg.easy)}</span></span>` +
        `<span class="v v-original"><span class="v-label">元の日本語：</span><span class="text">${escapeHtml(seg.original)}</span></span>` +
        `${badge}</${tag}>`,
    );
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

const CATEGORY_LABELS: Record<Warning["category"], string> = {
  "date-time": "日付・時刻",
  amount: "金額",
  quantity: "数・量",
  target: "対象者",
  condition: "条件",
  exception: "例外",
  negation: "否定",
  modality: "義務・可能性",
  "proper-noun": "固有名詞・正式名称",
  "url-contact": "URL・連絡先",
  terminology: "専門用語",
  "sensitive-domain": "専門家の確認",
  ambiguous: "意味があいまい",
  unsupported: "変換していない部分",
  "fact-check": "数字の照合",
  other: "その他",
};

const ORIGIN_LABELS: Record<Warning["origin"], string> = {
  llm: "AIの指摘",
  auto: "自動チェック",
  extract: "読み込み時",
};

const STATUS_LABELS: Record<Warning["status"], string> = {
  "needs-review": "人の確認が必要",
  unverified: "自動では確認できていない",
};

function renderWarnings(warnings: readonly Warning[], segmentsById: ReadonlyMap<string, MergedSegment>): string {
  if (warnings.length === 0) {
    return '  <p class="no-warnings">自動では、注意する点は見つかりませんでした。ただし、意味が同じかどうかは人が確認してください。</p>';
  }
  const firstIndexBySegment = new Map<string, number>();
  warnings.forEach((w, i) => {
    if (w.segmentId !== null && !firstIndexBySegment.has(w.segmentId)) firstIndexBySegment.set(w.segmentId, i);
  });
  const items = warnings.map((w, i) => {
    const seg = w.segmentId !== null ? segmentsById.get(w.segmentId) : undefined;
    const anchor = seg && firstIndexBySegment.get(seg.id) === i ? ` id="warn-${escapeHtml(seg.id)}"` : "";
    const where = seg
      ? `<p class="warn-where"><a href="#seg-${escapeHtml(seg.id)}">該当する文</a>：「${escapeHtml(truncate(seg.original, 80))}」</p>`
      : '<p class="warn-where">文章全体</p>';
    return (
      `  <li class="warning"${anchor}>` +
      `<p class="warn-head"><span class="tag">${escapeHtml(CATEGORY_LABELS[w.category])}</span>` +
      `<span class="tag tag-sub">${escapeHtml(ORIGIN_LABELS[w.origin])}</span>` +
      `<span class="tag tag-sub">${escapeHtml(STATUS_LABELS[w.status])}</span></p>` +
      `<p class="warn-msg">${escapeHtml(w.message)}</p>${where}</li>`
    );
  });
  return `  <ol class="warnings">\n${items.join("\n")}\n  </ol>`;
}

function truncate(s: string, max: number): string {
  const chars = [...s.replace(/\s+/g, " ")];
  return chars.length > max ? chars.slice(0, max).join("") + "…" : chars.join("");
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function sha256(content: string): string {
  return "sha256-" + createHash("sha256").update(content, "utf8").digest("base64");
}

/** 表示切替だけを行うスクリプト。DOM への文字列挿入はしない。 */
export const SCRIPT = `(function () {
  var root = document.documentElement;
  root.classList.remove("no-js");
  var buttons = document.querySelectorAll("[data-mode-button]");
  function setMode(mode) {
    root.setAttribute("data-mode", mode);
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mode-button") === mode));
    }
  }
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function (e) {
      setMode(e.currentTarget.getAttribute("data-mode-button"));
    });
  }
  setMode("easy");
})();`;

export const STYLE = `
:root {
  --bg: #ffffff; --fg: #1a1a1a; --muted: #555555; --line: #d0d0d0;
  --accent: #0b5cad; --accent-fg: #ffffff; --warn-bg: #fff4d6; --warn-line: #b37400; --note-bg: #eef4fb;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161616; --fg: #ececec; --muted: #b5b5b5; --line: #444444;
    --accent: #79b4ff; --accent-fg: #0b1a2a; --warn-bg: #3a2d0c; --warn-line: #e0a63a; --note-bg: #1d2a3a;
  }
}
* { box-sizing: border-box; }
html { font-size: 112.5%; }
body {
  margin: 0 auto; max-width: 46rem; padding: 1.5rem 1rem 3rem;
  background: var(--bg); color: var(--fg);
  font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
  line-height: 1.9; letter-spacing: 0.02em;
}
h1 { font-size: 1.5rem; line-height: 1.4; margin: 0 0 0.5rem; }
h2 { font-size: 1.25rem; line-height: 1.5; margin: 2rem 0 0.75rem; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.meta { color: var(--muted); font-size: 0.875rem; margin: 0 0 0.75rem; }
.notice { background: var(--note-bg); border-left: 4px solid var(--accent); padding: 0.75rem 1rem; margin: 0; font-size: 0.9rem; }
.toolbar {
  position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  background: var(--bg); padding: 0.75rem 0; margin: 1rem 0; border-bottom: 1px solid var(--line);
}
.toolbar-label { font-weight: bold; }
.toolbar button {
  font: inherit; font-size: 1rem; padding: 0.4rem 1rem; min-height: 44px; cursor: pointer;
  border: 2px solid var(--accent); border-radius: 999px; background: transparent; color: var(--accent);
}
.toolbar button[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg); font-weight: bold; }
.no-js .toolbar { display: none; }
.seg { display: block; margin: 0 0 1.25rem; }
h2.seg { margin-top: 1.75rem; }
.seg-list { padding-left: 1.5rem; margin: 0 0 1.25rem; }
li.seg { display: list-item; margin-bottom: 0.5rem; }
.text { white-space: pre-line; }
.v { display: block; }
.v-label { display: none; }
.no-js .v-label { display: inline; font-size: 0.8rem; color: var(--muted); font-weight: normal; }
.no-js .v-original { color: var(--muted); }
html:not(.no-js)[data-mode="easy"] .v-original { display: none; }
html:not(.no-js)[data-mode="original"] .v-easy { display: none; }
.has-warning { border-left: 4px solid var(--warn-line); padding-left: 0.75rem; }
li.has-warning { padding-left: 0.5rem; }
.badge {
  display: inline-block; font-size: 0.8rem; line-height: 1.6; padding: 0 0.5rem; margin-top: 0.25rem;
  border: 1px solid var(--warn-line); border-radius: 4px; background: var(--warn-bg); color: var(--fg); text-decoration: none;
}
.review, .about { border-top: 1px solid var(--line); margin-top: 2rem; }
.warnings { padding-left: 1.5rem; }
.warning { margin-bottom: 1rem; padding: 0.5rem 0.75rem; background: var(--warn-bg); border-radius: 4px; }
.warning p { margin: 0.25rem 0; }
.tag { display: inline-block; font-size: 0.8rem; font-weight: bold; margin-right: 0.5rem; }
.tag-sub { font-weight: normal; color: var(--muted); }
.warn-where { font-size: 0.875rem; color: var(--muted); }
.no-warnings { background: var(--note-bg); padding: 0.75rem 1rem; }
.page-footer { margin-top: 2rem; color: var(--muted); font-size: 0.8rem; }
`;
