import { UserError } from "../errors.ts";
import { WARNING_CATEGORIES, WARNING_STATUSES, type Warning } from "../types.ts";
import { isPlainObject } from "../util.ts";

const CATEGORY_SET = new Set<string>(WARNING_CATEGORIES);
const STATUS_SET = new Set<string>(WARNING_STATUSES);
const MAX_MESSAGE_LENGTH = 2000;

/** 警告の配列を検証する。不明なカテゴリ・状態・セグメントIDはエラーにして修正を促す。 */
export function parseWarnings(
  value: unknown,
  segmentIds: ReadonlySet<string>,
  origin: Warning["origin"],
  where: string,
): Warning[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new UserError(`${where}.warnings は配列にしてください`);
  return value.map((w: unknown, i: number) => {
    const at = `${where}.warnings[${i}]`;
    if (!isPlainObject(w)) throw new UserError(`${at} がオブジェクトではありません`);
    if (typeof w.category !== "string" || !CATEGORY_SET.has(w.category)) {
      throw new UserError(`${at}.category が不正です（使える値: ${WARNING_CATEGORIES.join(", ")}）`);
    }
    if (typeof w.status !== "string" || !STATUS_SET.has(w.status)) {
      throw new UserError(`${at}.status が不正です（使える値: ${WARNING_STATUSES.join(", ")}）`);
    }
    const segmentId = w.segmentId ?? null;
    if (segmentId !== null && (typeof segmentId !== "string" || !segmentIds.has(segmentId))) {
      throw new UserError(`${at}.segmentId が存在しないセグメントを指しています: ${String(segmentId)}`);
    }
    if (typeof w.message !== "string" || w.message.trim() === "") {
      throw new UserError(`${at}.message が空です`);
    }
    if (w.message.length > MAX_MESSAGE_LENGTH) throw new UserError(`${at}.message が長すぎます`);
    return {
      category: w.category as Warning["category"],
      segmentId,
      message: w.message.trim(),
      status: w.status as Warning["status"],
      origin,
    };
  });
}
