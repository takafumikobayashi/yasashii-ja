import { createHash } from "node:crypto";
import { UserError } from "./errors.ts";
import { MAX_SEGMENTS } from "./limits.ts";
import { isPlainObject } from "./util.ts";
import { parseWarnings } from "./validate/warnings.ts";
import { WORK_SCHEMA_VERSION, type Segment, type SourceKind, type Warning, type WorkFile } from "./types.ts";

const SEGMENT_KINDS = new Set(["heading", "paragraph", "list-item"]);

export function computeIntegrity(segments: readonly Segment[]): string {
  const canonical = JSON.stringify(segments.map((s) => [s.id, s.kind, s.original]));
  return "sha256-" + createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function createWorkFile(params: {
  kind: SourceKind;
  path: string | null;
  label: string;
  segments: Segment[];
  warnings?: Warning[];
}): WorkFile {
  return {
    schemaVersion: WORK_SCHEMA_VERSION,
    tool: "yasashii-ja",
    source: { kind: params.kind, path: params.path, label: params.label },
    segments: params.segments,
    integrity: computeIntegrity(params.segments),
    warnings: params.warnings ?? [],
  };
}

/** JSON.parse 済みの値を作業ファイルとして検証する。原文が改変されていればエラー。 */
export function parseWorkFile(value: unknown): WorkFile {
  const bad = (why: string) => new UserError(`作業ファイルが不正です: ${why}`);
  if (!isPlainObject(value)) throw bad("オブジェクトではありません");
  if (value.tool !== "yasashii-ja") throw bad("yasashii-ja の作業ファイルではありません");
  if (value.schemaVersion !== WORK_SCHEMA_VERSION) throw bad(`未対応の schemaVersion: ${String(value.schemaVersion)}`);

  const source = value.source;
  if (!isPlainObject(source) || source.kind !== "text" || typeof source.label !== "string") {
    throw bad("source が不正です");
  }
  if (source.path !== null && typeof source.path !== "string") throw bad("source.path が不正です");

  if (!Array.isArray(value.segments) || value.segments.length === 0) throw bad("segments がありません");
  if (value.segments.length > MAX_SEGMENTS) throw bad("segments が多すぎます");
  const ids = new Set<string>();
  const segments: Segment[] = value.segments.map((s: unknown, i: number) => {
    if (!isPlainObject(s)) throw bad(`segments[${i}] がオブジェクトではありません`);
    if (typeof s.id !== "string" || s.id === "") throw bad(`segments[${i}].id が不正です`);
    if (ids.has(s.id)) throw bad(`segments の id が重複しています: ${s.id}`);
    ids.add(s.id);
    if (typeof s.kind !== "string" || !SEGMENT_KINDS.has(s.kind)) throw bad(`segments[${i}].kind が不正です`);
    if (typeof s.original !== "string") throw bad(`segments[${i}].original が不正です`);
    return { id: s.id, kind: s.kind as Segment["kind"], original: s.original };
  });

  if (value.integrity !== computeIntegrity(segments)) {
    throw bad("原文（segments）が prepare の後に変更されています。prepare からやり直してください");
  }

  const warnings = parseWarnings(value.warnings, ids, "extract", "work");
  return {
    schemaVersion: WORK_SCHEMA_VERSION,
    tool: "yasashii-ja",
    source: { kind: "text", path: source.path as string | null, label: source.label },
    segments,
    integrity: value.integrity as string,
    warnings,
  };
}
