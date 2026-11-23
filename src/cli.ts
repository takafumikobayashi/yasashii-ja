#!/usr/bin/env node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { EXIT_NEEDS_CONFIRMATION, UserError } from "./errors.ts";
import { fileKindFromPath, looksLikePath } from "./input/classify.ts";
import { readUtf8File } from "./input/read.ts";
import { writeNewFile } from "./output/write.ts";
import { segmentPlainText } from "./parse/text.ts";
import { renderPreviewHtml } from "./render/html.ts";
import { mergeResult } from "./validate/result.ts";
import { createWorkFile, parseWorkFile } from "./work.ts";

const USAGE = `yasashii-ja — やさしい日本語プレビューの下準備と生成

使い方:
  node src/cli.ts prepare --text-file <文章を書いたファイル> [--work <作業ファイル>] [--confirm-text]
  node src/cli.ts prepare <入力ファイル>        （.md / .html / .json は今後対応予定）
  node src/cli.ts render --work <作業ファイル> --result <変換結果ファイル> [--out <出力.html>] [--force]

prepare : 文章を段落に分け、変換前の作業ファイル（JSON）を作ります。原文は変更しません。
render  : 変換結果を検証し、原文とやさしい日本語を切り替えられる単体HTMLを作ります。
          同名のファイルがあるときは上書きせず、別名（-2 など）で保存します。--force で上書きします。

終了コード: 0 成功 / 1 エラー / 2 利用者の確認が必要`;

export function main(argv: string[], io: { cwd: string; now: () => Date } = { cwd: process.cwd(), now: () => new Date() }): number {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "prepare":
        return prepare(rest, io.cwd);
      case "render":
        return render(rest, io);
      case undefined:
      case "-h":
      case "--help":
      case "help":
        process.stdout.write(USAGE + "\n");
        return command === undefined ? 1 : 0;
      default:
        throw new UserError(`不明なコマンドです: ${command}\n\n${USAGE}`);
    }
  } catch (e) {
    if (e instanceof UserError) {
      process.stderr.write(`エラー: ${e.message}\n`);
      return e.exitCode;
    }
    throw e;
  }
}

function prepare(args: string[], cwd: string): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "text-file": { type: "string" },
      work: { type: "string" },
      "confirm-text": { type: "boolean", default: false },
    },
  });

  if (values["text-file"] !== undefined && positionals.length > 0) {
    throw new UserError("--text-file と入力ファイルは同時に指定できません");
  }

  if (values["text-file"] === undefined) {
    const input = positionals[0];
    if (input === undefined || positionals.length > 1) {
      throw new UserError("入力を1つだけ指定してください（文章は --text-file で渡します）");
    }
    const kind = fileKindFromPath(input);
    readUtf8File(resolve(cwd, input)); // 存在・サイズ・文字コードを先に確認する
    if (kind === "markdown" || kind === "html") {
      throw new UserError(`${kind === "markdown" ? "Markdown" : "HTML"} ファイルの読み込みはまだ実装していません（M2 で対応予定）`);
    }
    if (kind === "json") {
      throw new UserError("JSON ファイルの変換はまだ実装していません（M3 で対応予定）");
    }
    throw new UserError(`対応していない種類のファイルです: ${input}（対応予定: .md / .html / .htm / .json）`);
  }

  const text = readUtf8File(resolve(cwd, values["text-file"]));
  if (looksLikePath(text) && !values["confirm-text"]) {
    throw new UserError(
      `「${text.trim()}」はファイルの場所のように見えますが、文章として変換しようとしています。` +
        "ファイルの場所が正しいか確認してください。この文字列そのものを変換したい場合は --confirm-text を付けてください。",
      EXIT_NEEDS_CONFIRMATION,
    );
  }

  const segments = segmentPlainText(text);
  const work = createWorkFile({ kind: "text", path: null, label: "直接入力した文章", segments });
  const workPath = values.work !== undefined
    ? resolve(cwd, values.work)
    : join(mkdtempSync(join(tmpdir(), "yasashii-ja-")), "work.json");
  const saved = writeNewFile(workPath, JSON.stringify(work, null, 2) + "\n");

  printJson({
    ok: true,
    workFile: saved.path,
    resultFile: join(resolve(saved.path, ".."), "result.json"),
    suggestedOutput: defaultOutputPath(cwd),
    segments: work.segments,
    warnings: work.warnings,
  });
  return 0;
}

function render(args: string[], io: { cwd: string; now: () => Date }): number {
  const { values } = parseArgs({
    args,
    options: {
      work: { type: "string" },
      result: { type: "string" },
      out: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  if (values.work === undefined || values.result === undefined) {
    throw new UserError("--work と --result を指定してください");
  }
  const workPath = resolve(io.cwd, values.work);
  const resultPath = resolve(io.cwd, values.result);
  const work = parseWorkFile(readJson(workPath, "作業ファイル"));
  const doc = mergeResult(work, readJson(resultPath, "変換結果ファイル"));

  const outPath = values.out !== undefined ? resolve(io.cwd, values.out) : defaultOutputPath(io.cwd);
  const ext = extname(outPath).toLowerCase();
  if (ext !== ".html" && ext !== ".htm") {
    throw new UserError(`出力ファイル名は .html で終わるようにしてください: ${outPath}`);
  }

  const html = renderPreviewHtml(doc, { generatedAt: io.now() });
  const protectedPaths = [workPath, resultPath, ...(work.source.path ? [work.source.path] : [])];
  const saved = writeNewFile(outPath, html, { force: values.force, protectedPaths });

  printJson({
    ok: true,
    output: saved.path,
    renamed: saved.renamed,
    segmentCount: doc.segments.length,
    warningCount: doc.warnings.length,
    warnings: doc.warnings,
  });
  return 0;
}

function defaultOutputPath(cwd: string): string {
  return join(cwd, "yasashii-preview.html");
}

function readJson(path: string, label: string): unknown {
  const text = readUtf8File(path);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new UserError(`${label}が正しい JSON ではありません: ${path}（${(e as Error).message}）`);
  }
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
