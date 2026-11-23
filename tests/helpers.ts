import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "yasashii-test-")));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
