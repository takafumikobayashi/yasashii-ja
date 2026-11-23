/**
 * 中間表現（作業ファイル）と、LLM（Claude）が返す変換結果の型。
 * 形式は .claude/skills/yasashii-ja/references/work-format.md に記載。
 */

export const WORK_SCHEMA_VERSION = 1;

export type SourceKind = "text";

export type SegmentKind = "heading" | "paragraph" | "list-item";

export interface Segment {
  id: string;
  kind: SegmentKind;
  original: string;
}

export interface WorkFile {
  schemaVersion: typeof WORK_SCHEMA_VERSION;
  tool: "yasashii-ja";
  source: {
    kind: SourceKind;
    /** 入力ファイルの絶対パス。直接テキストは null。 */
    path: string | null;
    label: string;
  };
  segments: Segment[];
  /** segments の id/kind/original から計算した SHA-256。原文の改変検出に使う。 */
  integrity: string;
  /** 抽出時点の警告（未対応の構造など）。 */
  warnings: Warning[];
}

export const WARNING_CATEGORIES = [
  "date-time",
  "amount",
  "quantity",
  "target",
  "condition",
  "exception",
  "negation",
  "modality",
  "proper-noun",
  "url-contact",
  "terminology",
  "sensitive-domain",
  "ambiguous",
  "unsupported",
  "fact-check",
  "other",
] as const;

export type WarningCategory = (typeof WARNING_CATEGORIES)[number];

/**
 * 検証状態。「合格」を表す値は意図的に持たない。
 * - needs-review: 人の確認が必要
 * - unverified: 自動では検査できなかった
 */
export const WARNING_STATUSES = ["needs-review", "unverified"] as const;
export type WarningStatus = (typeof WARNING_STATUSES)[number];

export interface Warning {
  category: WarningCategory;
  /** 対象セグメント。文書全体に関わる場合は null。 */
  segmentId: string | null;
  message: string;
  status: WarningStatus;
  /** llm: Claude の指摘 / auto: 決定論的チェック / extract: 抽出時の通知 */
  origin: "llm" | "auto" | "extract";
}

/** Claude が書く変換結果ファイル。 */
export interface ResultFile {
  segments: { id: string; easy: string }[];
  warnings?: Omit<Warning, "origin">[];
}

export interface MergedSegment extends Segment {
  easy: string;
}

export interface PreviewDocument {
  source: WorkFile["source"];
  segments: MergedSegment[];
  warnings: Warning[];
}
