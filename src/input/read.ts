import { readFileSync, statSync } from "node:fs";
import { UserError } from "../errors.ts";
import { MAX_INPUT_BYTES } from "../limits.ts";

/** UTF-8 として厳密に読み込む。BOM は取り除く。上限超過・不正なバイト列はエラー。 */
export function readUtf8File(path: string): string {
  let size: number;
  try {
    const st = statSync(path);
    if (!st.isFile()) throw new UserError(`ファイルではありません: ${path}`);
    size = st.size;
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError(`ファイルが見つかりません: ${path}`);
  }
  if (size > MAX_INPUT_BYTES) {
    throw new UserError(
      `入力が大きすぎます（${size} バイト）。上限は ${MAX_INPUT_BYTES} バイトです。ファイルを分けてください。`,
    );
  }
  return decodeUtf8(readFileSync(path));
}

export function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_INPUT_BYTES) {
    throw new UserError(`入力が大きすぎます。上限は ${MAX_INPUT_BYTES} バイトです。`);
  }
  try {
    // ignoreBOM: false（既定）で先頭の BOM は取り除かれる
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UserError("UTF-8 として読み込めません（文字化けの可能性があります）。UTF-8 で保存してください。");
  }
}
