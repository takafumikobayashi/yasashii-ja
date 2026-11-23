import { UserError } from "../errors.ts";
import type { MergedSegment, PreviewDocument, Warning, WorkFile } from "../types.ts";
import { isPlainObject } from "../util.ts";
import { autoFactChecks } from "./facts.ts";
import { parseWarnings } from "./warnings.ts";

/**
 * Claude が書いた変換結果を作業ファイルと照合し、プレビュー用の文書にまとめる。
 * - すべてのセグメントIDに、空でない easy が1つずつあること
 * - 未知のIDや重複がないこと
 * - 警告の形式が正しいこと
 * 構造の不一致はエラー（成果物を作らない）。意味のずれの疑いは警告として追加する。
 */
export function mergeResult(work: WorkFile, result: unknown): PreviewDocument {
  if (!isPlainObject(result)) throw new UserError("変換結果がオブジェクトではありません");
  if (!Array.isArray(result.segments)) throw new UserError("変換結果に segments 配列がありません");

  const known = new Set(work.segments.map((s) => s.id));
  const easyById = new Map<string, string>();
  result.segments.forEach((s: unknown, i: number) => {
    const at = `result.segments[${i}]`;
    if (!isPlainObject(s)) throw new UserError(`${at} がオブジェクトではありません`);
    if (typeof s.id !== "string" || !known.has(s.id)) {
      throw new UserError(`${at}.id が作業ファイルにありません: ${String(s.id)}`);
    }
    if (easyById.has(s.id)) throw new UserError(`${at}.id が重複しています: ${s.id}`);
    if (typeof s.easy !== "string" || s.easy.trim() === "") {
      throw new UserError(`${at}.easy が空です（id: ${s.id}）。変換できない場合は原文をそのまま入れ、理由を警告（status: unverified）に書いてください`);
    }
    easyById.set(s.id, normalizeNewlines(s.easy).trim());
  });

  const missing = work.segments.filter((s) => !easyById.has(s.id)).map((s) => s.id);
  if (missing.length > 0) {
    throw new UserError(`変換結果が足りません。未変換のID: ${missing.join(", ")}`);
  }

  const segments: MergedSegment[] = work.segments.map((s) => ({ ...s, easy: easyById.get(s.id)! }));
  const llmWarnings = parseWarnings(result.warnings, known, "llm", "result");
  const warnings: Warning[] = [...work.warnings, ...llmWarnings, ...autoFactChecks(segments)];

  return { source: work.source, segments, warnings };
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}
