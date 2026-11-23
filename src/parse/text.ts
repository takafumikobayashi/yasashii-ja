import { UserError } from "../errors.ts";
import { MAX_SEGMENTS } from "../limits.ts";
import type { Segment } from "../types.ts";

/** 記号の箇条書き（※は含めない：注記の意味を持つため）。記号は取り除き kind で表す。 */
const BULLET = /^\s*(?:[・•]\s*|[-*]\s+)/u;
/** 番号付きの箇条書き。番号は順序の情報なので original に残す。 */
const NUMBERED = /^\s*[0-9０-９]+[.．)）]\s+/u;

/**
 * プレーンテキストを段落・箇条書きのセグメントに分ける。
 * - 改行コードを LF に正規化し、空行で段落を区切る。
 * - 段落内のすべての行が行頭記号で始まる場合は、各行を list-item にする。
 * - それ以外の段落内の改行は保持する（表示時に改行として扱う）。
 * - 「・」「-」「*」の行頭記号は取り除き、箇条書きであることは kind で表す。
 *   番号（「1.」など）は順序の情報なので original に残す。
 */
export function segmentPlainText(input: string): Segment[] {
  const text = input.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  const blocks = text
    .split(/\n[ \t\u3000]*\n/)
    .map((b) => trimLines(b))
    .filter((b) => b !== "");

  const segments: Segment[] = [];
  const push = (kind: Segment["kind"], original: string) => {
    segments.push({ id: `s${segments.length + 1}`, kind, original });
    if (segments.length > MAX_SEGMENTS) {
      throw new UserError(`段落が多すぎます（上限 ${MAX_SEGMENTS}）。文章を分けて実行してください。`);
    }
  };

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.every((l) => BULLET.test(l) || NUMBERED.test(l))) {
      for (const line of lines) {
        const body = line.replace(BULLET, "").trim();
        if (body !== "") push("list-item", body);
      }
    } else {
      push("paragraph", block);
    }
  }

  if (segments.length === 0) {
    throw new UserError("変換する文章がありません（空の入力です）。");
  }
  return segments;
}

function trimLines(block: string): string {
  return block
    .split("\n")
    .map((l) => l.replace(/[ \t\u3000]+$/u, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
    .replace(/^[ \t\u3000]+/u, "");
}
