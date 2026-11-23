import { randomBytes } from "node:crypto";
import { constants, copyFileSync, existsSync, linkSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { UserError } from "../errors.ts";

const MAX_RENAME_ATTEMPTS = 99;

/**
 * 新しいファイルとして安全に保存し、実際に保存したパスを返す。
 * - いったん同じフォルダの一時ファイルに書き切ってから配置する（途中で失敗しても壊れたファイルが残らない）。
 * - 既に同名のファイルがあるときは上書きせず、`name-2.html` のように別名にする。
 * - force のときだけ上書きする。ただし protectedPaths（入力ファイルなど）は force でも上書きしない。
 */
export function writeNewFile(
  desiredPath: string,
  content: string,
  options: { force?: boolean; protectedPaths?: readonly string[] } = {},
): { path: string; renamed: boolean } {
  const target = resolve(desiredPath);
  const dir = dirname(target);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new UserError(`保存先のフォルダがありません: ${dir}`);
  }
  const protectedSet = new Set((options.protectedPaths ?? []).map(canonical));

  const tmp = join(dir, `.${basename(target)}.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(tmp, content, { encoding: "utf8", flag: "wx" });
  try {
    if (options.force) {
      if (protectedSet.has(canonical(target))) {
        throw new UserError(`入力ファイルと同じ場所には保存できません: ${target}`);
      }
      renameSync(tmp, target);
      return { path: target, renamed: false };
    }
    for (let n = 1; n <= MAX_RENAME_ATTEMPTS; n++) {
      const candidate = n === 1 ? target : withSuffix(target, n);
      if (protectedSet.has(canonical(candidate))) continue;
      if (placeExclusive(tmp, candidate)) return { path: candidate, renamed: n > 1 };
    }
    throw new UserError(`同じ名前のファイルが多すぎます。--out で別の保存先を指定してください: ${target}`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** 既存ファイルがあれば false。あれば上書きしないことをファイルシステムの機能で保証する。 */
function placeExclusive(tmp: string, dest: string): boolean {
  try {
    linkSync(tmp, dest); // 既存なら EEXIST で失敗する（原子的）
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return false;
    if (code === "EPERM" || code === "ENOTSUP" || code === "EXDEV" || code === "ENOSYS") {
      // ハードリンク非対応のファイルシステム向け。COPYFILE_EXCL で既存ファイルは上書きしない。
      try {
        copyFileSync(tmp, dest, constants.COPYFILE_EXCL);
        return true;
      } catch (e2) {
        if ((e2 as NodeJS.ErrnoException).code === "EEXIST") return false;
        throw e2;
      }
    }
    throw e;
  }
}

export function withSuffix(path: string, n: number): string {
  const ext = extname(path);
  return join(dirname(path), `${basename(path, ext)}-${n}${ext}`);
}

function canonical(p: string): string {
  const abs = resolve(p);
  try {
    return realpathSync(abs);
  } catch {
    // まだ存在しないパスは、フォルダ部分だけ実体に解決する
    try {
      return join(realpathSync(dirname(abs)), basename(abs));
    } catch {
      return abs;
    }
  }
}
