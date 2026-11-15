/**
 * @fileoverview Find a real Node.js binary. `bun run` under `bunfig.toml`'s
 * `[run] bun = true` puts Bun's `node` shim first on `PATH` for every child, so a bare
 * `node` there is Bun; the gate's Node lanes need the binary past it.
 * @module scripts/node-binary
 */
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';

/** The first `node` on `PATH` that is Node.js rather than Bun, or `undefined` when none is. */
export function nodeBinary(): string | undefined {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    const probe = spawnSync(candidate, ['-p', 'process.versions.bun'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === 'undefined') return candidate;
  }
  return undefined;
}
