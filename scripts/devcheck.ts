#!/usr/bin/env bun
/**
 * @fileoverview Local gate — run before declaring any work complete and before every
 * commit. Sequential steps, loud output, non-zero exit on any failure. Warnings are
 * failures: Biome runs with `--error-on-warnings`, so a green run means zero
 * diagnostics. Biome also auto-fixes formatting, so read the output raw.
 * @module scripts/devcheck
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync } from 'node:fs';

interface StepResult {
  detail?: string;
  ok: boolean;
}

interface Step {
  name: string;
  run: () => StepResult;
}

function shell(command: string, args: string[]): StepResult {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  return { ok: result.status === 0 };
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const [major, minor] = pkg.version.split('.');
const changelogFile = `changelog/${major}.${minor}.x/${pkg.version}.md`;

const steps: Step[] = [
  {
    name: 'Biome (format + lint, zero warnings)',
    run: () => shell('bunx', ['biome', 'check', '--write', '--error-on-warnings', '.']),
  },
  {
    name: 'Typecheck (tsc --noEmit)',
    run: () => shell('bunx', ['tsc', '--noEmit']),
  },
  {
    name: 'Build (clean + tsc → dist)',
    run: () => shell('bun', ['run', 'rebuild']),
  },
  {
    name: 'Tests (unit + corpus)',
    run: () => shell('bunx', ['vitest', 'run']),
  },
  {
    name: 'Changelog carries the current version and CHANGELOG.md is in sync',
    run: () =>
      existsSync(changelogFile)
        ? shell('bun', ['run', 'scripts/build-changelog.ts', '--check'])
        : { detail: `${changelogFile} is missing`, ok: false },
  },
  {
    name: 'Corpus attribution is in sync with fixture meta',
    run: () => shell('bun', ['run', 'scripts/corpus/attribution.ts', '--check']),
  },
  {
    name: 'Package exports (publint)',
    run: () => shell('bunx', ['publint', '--strict']),
  },
  {
    name: 'Package types resolve (attw, ESM only)',
    run: () => shell('bunx', ['attw', '--pack', '.', '--profile', 'esm-only']),
  },
  {
    name: 'Skill links (.claude/skills and .agents/skills → skills/)',
    run: () => {
      const broken = ['.claude/skills', '.agents/skills'].filter((link) => {
        try {
          return readlinkSync(link) !== '../skills';
        } catch {
          return true;
        }
      });
      return broken.length === 0
        ? { ok: true }
        : { detail: `${broken.join(', ')} must be a symlink to ../skills`, ok: false };
    },
  },
  {
    name: 'Dependency audit (high and critical)',
    run: () => shell('bun', ['audit', '--audit-level=high']),
  },
];

let failed = 0;
for (const step of steps) {
  console.log(`\n━━━ ${step.name} ━━━`);
  const result = step.run();
  if (result.ok) {
    console.log(`✅ PASSED: ${step.name}`);
  } else {
    failed += 1;
    console.log(
      `❌ FAILED: ${step.name}${result.detail === undefined ? '' : ` — ${result.detail}`}`,
    );
  }
}

console.log(
  failed === 0
    ? `\n✅ devcheck: all ${steps.length} steps passed (v${pkg.version})`
    : `\n❌ devcheck: ${failed}/${steps.length} step(s) failed`,
);
process.exit(failed === 0 ? 0 : 1);
