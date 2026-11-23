import type { MergedSegment, Warning } from "../types.ts";

/**
 * 決定論的な簡易チェック（docs/04 品質の第2層「事実の保持」の一部）。
 * 原文にある数字・URL・メールアドレス・否定表現が、変換後に見当たらない場合に警告する。
 *
 * これは「見つからない」ことを知らせるだけで、見つかった場合に意味の一致を保証するものではない。
 * 漢数字（三十）・和暦・曜日などはまだ照合しない（既知の制限）。
 */
export function autoFactChecks(segments: readonly MergedSegment[]): Warning[] {
  const warnings: Warning[] = [];
  for (const seg of segments) {
    const original = normalize(seg.original);
    const easy = normalize(seg.easy);
    const add = (category: Warning["category"], message: string) =>
      warnings.push({ category, segmentId: seg.id, message, status: "needs-review", origin: "auto" });

    const missingUrls = unique(extractUrls(original)).filter((u) => !easy.includes(u));
    if (missingUrls.length > 0) {
      add("url-contact", `原文のURLが変換後に見つかりません: ${missingUrls.join(" / ")}`);
    }

    const missingEmails = unique(extractEmails(original)).filter((m) => !easy.includes(m));
    if (missingEmails.length > 0) {
      add("url-contact", `原文のメールアドレスが変換後に見つかりません: ${missingEmails.join(" / ")}`);
    }

    // URL・メール内の数字は上で照合済みなので取り除いてから数字を比べる
    const easyNumbers = new Set(extractNumbers(stripUrlsAndEmails(easy)));
    const missingNumbers = unique(extractNumbers(stripUrlsAndEmails(original))).filter((n) => !easyNumbers.has(n));
    if (missingNumbers.length > 0) {
      add(
        "fact-check",
        `原文の数字が変換後に見つかりません: ${missingNumbers.join("、")}（日付・金額・数量・電話番号などが変わっていないか確認してください）`,
      );
    }

    if (hasNegation(original) && !hasNegation(easy)) {
      add("negation", "原文には否定の表現がありますが、変換後には見つかりません。意味が逆になっていないか確認してください（簡易チェック）");
    }
  }
  return warnings;
}

/** 全角英数字・記号を半角に寄せる（NFKC）。 */
function normalize(s: string): string {
  return s.normalize("NFKC");
}

const URL_RE = /https?:\/\/[^\s<>"'`()（）「」『』【】、。]+/giu;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function extractUrls(s: string): string[] {
  return (s.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
}

export function extractEmails(s: string): string[] {
  return s.match(EMAIL_RE) ?? [];
}

function stripUrlsAndEmails(s: string): string {
  return s.replace(URL_RE, " ").replace(EMAIL_RE, " ");
}

/**
 * 数字の並びを取り出す。桁区切りのカンマは取り除いて比べる（1,000 と 1000 は同じ）。
 * 電話番号（03-1234-5678）は数字のかたまりごとに比べる。
 */
export function extractNumbers(s: string): string[] {
  return (s.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/** 否定の表現（簡易）。ひらがなの一般語に含まれやすい「ず」などは誤検出が多いため含めない。 */
const NEGATION_RE = /ない|なく|ません|なかっ|ぬ(?:[。、\s]|$)|不要|不可|禁止|無効/u;

export function hasNegation(s: string): boolean {
  return NEGATION_RE.test(s);
}

function unique<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}
