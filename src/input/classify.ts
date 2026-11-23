/**
 * 直接テキストとして渡された文字列が「ファイルパスらしい」かを判定する。
 * パスらしいのにファイルが無い場合、その文字列自体を変換してしまわないよう確認を求めるために使う。
 */
const PATH_EXTENSIONS = /\.(md|markdown|html?|json|txt)$/i;
const PATH_PREFIX = /^(\.{1,2}[\\/]|~[\\/]|[\\/]|[A-Za-z]:[\\/])/;

export function looksLikePath(text: string): boolean {
  const t = text.trim();
  if (t === "" || /\s/.test(t)) return false; // 空白・改行を含むなら文章とみなす
  if (t.length > 1024) return false;
  return PATH_EXTENSIONS.test(t) || PATH_PREFIX.test(t);
}

export type InputFileKind = "markdown" | "html" | "json" | "unknown";

export function fileKindFromPath(path: string): InputFileKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".json")) return "json";
  return "unknown";
}
